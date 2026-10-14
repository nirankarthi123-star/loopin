/**
 * AWS EventBridge Scheduler and SNS Notification Dispatcher — LoopIn Backend
 *
 * Provides:
 * 1. Interface for scheduling and canceling one-time reminders.
 * 2. SNS publisher with strict privacy, structured attributes, and non-blocking simulation mode.
 * 3. Real AWS implementations and zero-cost in-memory simulation implementations.
 */

import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
  GetScheduleCommand,
  ActionAfterCompletion,
  FlexibleTimeWindowMode,
} from "@aws-sdk/client-scheduler";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import type { ReminderType } from "@loopin/shared";
import type { ScheduledReminderEvent } from "../domain/reminders.js";

export interface ScheduleReminderOptions {
  loanId: string;
  reminderType: ReminderType;
  scheduledTimeIso: string;
  correlationId?: string;
}

export interface ISchedulerService {
  scheduleReminder(options: ScheduleReminderOptions): Promise<{ scheduleName: string }>;
  cancelReminder(scheduleName: string): Promise<boolean>;
  getSchedule(scheduleName: string): Promise<{ scheduleName: string; status: string } | null>;
}

export interface INotificationPublisher {
  publishReminder(options: {
    recipientEmail?: string | undefined;
    subject: string;
    body: string;
    structuredMessage: Record<string, unknown>;
  }): Promise<{ messageId: string; delivered: boolean; isSimulated: boolean }>;
}

// ── Real AWS EventBridge Scheduler Service ────────────────────────────────────

export class AwsEventBridgeSchedulerService implements ISchedulerService {
  private client: SchedulerClient;
  private scheduleGroupName: string;
  private targetLambdaArn: string;
  private executionRoleArn: string;

  constructor() {
    const region = process.env["AWS_REGION"] ?? "ap-south-1";
    this.client = new SchedulerClient({ region });
    this.scheduleGroupName = process.env["REMINDER_SCHEDULE_GROUP"] ?? "loopin-reminders-dev";
    this.targetLambdaArn = process.env["REMINDER_LAMBDA_ARN"] ?? "";
    this.executionRoleArn = process.env["SCHEDULER_EXECUTION_ROLE_ARN"] ?? "";
  }

  async scheduleReminder(options: ScheduleReminderOptions): Promise<{ scheduleName: string }> {
    if (!this.targetLambdaArn || !this.executionRoleArn) {
      throw new Error(
        "EventBridge Scheduler configuration missing: REMINDER_LAMBDA_ARN and SCHEDULER_EXECUTION_ROLE_ARN must be configured.",
      );
    }

    const safeType = options.reminderType.replace(/_/g, "-");
    const uniqueSuffix = Date.now().toString(36);
    // EventBridge Scheduler schedule name constraint: max 64 chars, ^[a-zA-Z0-9_-]+$
    const cleanLoanId = options.loanId.replace(/^loan-/, "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
    const scheduleName = `lp-${cleanLoanId}-${safeType}-${uniqueSuffix.slice(-6)}`;

    // Convert ISO to at(yyyy-mm-ddThh:mm:ss) format expected by EventBridge Scheduler in UTC
    const date = new Date(options.scheduledTimeIso);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid schedule timestamp format: '${options.scheduledTimeIso}'`);
    }

    // Safety check: EventBridge Scheduler rejects schedules in the past
    if (date.getTime() <= Date.now()) {
      console.warn(
        `[AwsEventBridgeScheduler] Scheduled time ${options.scheduledTimeIso} is in the past or expired. Skipping schedule creation.`,
      );
      return { scheduleName: `expired-${safeType}` };
    }

    const scheduleExpression = `at(${date.toISOString().split(".")[0]})`;

    const eventPayload: ScheduledReminderEvent = {
      version: "1.0",
      source: "loopin.scheduler",
      detailType: "LoanReturnReminder",
      time: new Date().toISOString(),
      detail: {
        loanId: options.loanId,
        reminderType: options.reminderType,
        scheduledFor: options.scheduledTimeIso,
        attempt: 1,
        correlationId: options.correlationId ?? `sched-${Date.now()}`,
      },
    };

    const command = new CreateScheduleCommand({
      Name: scheduleName,
      GroupName: this.scheduleGroupName,
      ScheduleExpression: scheduleExpression,
      ScheduleExpressionTimezone: "UTC",
      FlexibleTimeWindow: {
        Mode: FlexibleTimeWindowMode.OFF, // Exact one-time schedule
      },
      Target: {
        Arn: this.targetLambdaArn,
        RoleArn: this.executionRoleArn,
        Input: JSON.stringify(eventPayload),
        RetryPolicy: {
          MaximumRetryAttempts: 2,
          MaximumEventAgeInSeconds: 3600, // 1 hour max age
        },
      },
      ActionAfterCompletion: ActionAfterCompletion.DELETE, // Auto cleanup schedule quota after firing
    });

    try {
      await this.client.send(command);
      return { scheduleName };
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      // If schedule already exists, consider it idempotent
      if (error.name === "ConflictException") {
        return { scheduleName };
      }
      throw err;
    }
  }

  async cancelReminder(scheduleName: string): Promise<boolean> {
    if (!scheduleName || scheduleName.startsWith("expired-") || scheduleName.startsWith("past-")) {
      return false;
    }

    try {
      const command = new DeleteScheduleCommand({
        Name: scheduleName,
        GroupName: this.scheduleGroupName,
      });
      await this.client.send(command);
      return true;
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error.name === "ResourceNotFoundException") {
        return false;
      }
      throw err;
    }
  }

  async getSchedule(scheduleName: string): Promise<{ scheduleName: string; status: string } | null> {
    try {
      const command = new GetScheduleCommand({
        Name: scheduleName,
        GroupName: this.scheduleGroupName,
      });
      const res = await this.client.send(command);
      return {
        scheduleName,
        status: res.State ?? "UNKNOWN",
      };
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error.name === "ResourceNotFoundException") {
        return null;
      }
      throw err;
    }
  }
}

// ── Real AWS SNS Publisher ────────────────────────────────────────────────────

export class AwsSnsNotificationPublisher implements INotificationPublisher {
  private client: SNSClient;
  private topicArn: string;

  constructor() {
    const region = process.env["AWS_REGION"] ?? "ap-south-1";
    this.client = new SNSClient({ region });
    this.topicArn = process.env["SNS_TOPIC_ARN"] ?? process.env["NOTIFICATIONS_TOPIC_ARN"] ?? "";
  }

  async publishReminder(options: {
    recipientEmail?: string;
    subject: string;
    body: string;
    structuredMessage: Record<string, unknown>;
  }): Promise<{ messageId: string; delivered: boolean; isSimulated: boolean }> {
    if (!this.topicArn) {
      throw new Error(
        "SNS topic is not configured: SNS_TOPIC_ARN (or NOTIFICATIONS_TOPIC_ARN) must be defined.",
      );
    }

    const command = new PublishCommand({
      TopicArn: this.topicArn,
      Subject: options.subject.slice(0, 100), // SNS subject length limitation
      Message: options.body,
      MessageAttributes: {
        ReminderType: {
          DataType: "String",
          StringValue: String(options.structuredMessage["reminderType"] ?? "general"),
        },
        LoanId: {
          DataType: "String",
          StringValue: String(options.structuredMessage["loanId"] ?? "unknown"),
        },
      },
    });

    const res = await this.client.send(command);
    // SNS publish confirms successful receipt and queuing by Amazon SNS topic broker
    return {
      messageId: res.MessageId ?? `sns-${Date.now()}`,
      delivered: true,
      isSimulated: false,
    };
  }
}

// ── In-Memory Simulated Scheduler & SNS (Zero Cloud Cost Demo Mode) ───────────

export interface SimulatedSchedule {
  name: string;
  loanId: string;
  reminderType: ReminderType;
  scheduledTimeIso: string;
  status: "ACTIVE" | "CANCELLED" | "TRIGGERED";
  createdAt: string;
}

export interface SimulatedDispatchedNotification {
  notificationId: string;
  timestamp: string;
  recipientEmail?: string | undefined;
  subject: string;
  body: string;
  structuredMessage: Record<string, unknown>;
  status: "dispatched" | "simulated";
}

export class SimulatedSchedulerService implements ISchedulerService {
  private schedules = new Map<string, SimulatedSchedule>();
  private scheduleCounter = 0;

  async scheduleReminder(options: ScheduleReminderOptions): Promise<{ scheduleName: string }> {
    const safeType = options.reminderType.replace(/_/g, "-");
    this.scheduleCounter += 1;
    const scheduleName = `loan-${options.loanId}-${safeType}-v${this.scheduleCounter}`;

    this.schedules.set(scheduleName, {
      name: scheduleName,
      loanId: options.loanId,
      reminderType: options.reminderType,
      scheduledTimeIso: options.scheduledTimeIso,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    });

    return { scheduleName };
  }

  async cancelReminder(scheduleName: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleName);
    if (!schedule) return false;
    schedule.status = "CANCELLED";
    return true;
  }

  async getSchedule(scheduleName: string): Promise<{ scheduleName: string; status: string } | null> {
    const s = this.schedules.get(scheduleName);
    return s ? { scheduleName: s.name, status: s.status } : null;
  }

  getAllSchedules(): SimulatedSchedule[] {
    return Array.from(this.schedules.values());
  }

  clear(): void {
    this.schedules.clear();
  }
}

export class SimulatedSnsPublisher implements INotificationPublisher {
  private dispatched: SimulatedDispatchedNotification[] = [];
  public failNext = false;

  async publishReminder(options: {
    recipientEmail?: string;
    subject: string;
    body: string;
    structuredMessage: Record<string, unknown>;
  }): Promise<{ messageId: string; delivered: boolean; isSimulated: boolean }> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("Simulated SNS network timeout/publish error");
    }

    const messageId = `sim-sns-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.dispatched.push({
      notificationId: messageId,
      timestamp: new Date().toISOString(),
      recipientEmail: options.recipientEmail,
      subject: options.subject,
      body: options.body,
      structuredMessage: options.structuredMessage,
      status: "simulated",
    });

    return {
      messageId,
      delivered: true,
      isSimulated: true,
    };
  }

  getDispatched(): SimulatedDispatchedNotification[] {
    return [...this.dispatched];
  }

  clear(): void {
    this.dispatched = [];
    this.failNext = false;
  }
}
