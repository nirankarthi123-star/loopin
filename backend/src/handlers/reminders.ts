/**
 * Reminder Processor Lambda Handler — LoopIn Backend
 *
 * Triggered by Amazon EventBridge Scheduler or local simulator.
 *
 * Guarantees:
 * 1. Authoritative check: Reads latest state directly from DynamoDB repository.
 * 2. Skips completed, rejected, cancelled, or inactive loans.
 * 3. Idempotency: Records sent status in DynamoDB to eliminate duplicate deliveries on retry.
 * 4. Logs operational metrics, skip reasons, and execution metadata without leaking PII.
 */

import { getRepository } from "../repository/factory.js";
import type { ILoopInRepository } from "../repository/interface.js";
import type { Loan, LoanReminderRecord, ReminderType } from "@loopin/shared";
import {
  evaluateReminderDecision,
  type ScheduledReminderEvent,
} from "../domain/reminders.js";
import {
  type INotificationPublisher,
  AwsSnsNotificationPublisher,
  SimulatedSnsPublisher,
} from "../services/notifications.service.js";

export interface ReminderProcessorResult {
  statusCode: number;
  loanId: string;
  reminderType: ReminderType;
  action: "sent" | "skipped" | "failed";
  reason?: string | undefined;
  messageId?: string | undefined;
  isSimulated: boolean;
}

export class ReminderProcessor {
  constructor(
    private readonly repo: ILoopInRepository,
    private readonly publisher: INotificationPublisher,
  ) {}

  async processEvent(event: ScheduledReminderEvent): Promise<ReminderProcessorResult> {
    const { loanId, reminderType, scheduledFor, correlationId } = event.detail;
    const isSimulated = event.source === "loopin.simulator" || process.env["SIMULATION_MODE"] === "true";

    console.info("[ReminderProcessor] Processing scheduled reminder:", {
      loanId,
      reminderType,
      scheduledFor,
      correlationId,
      isSimulated,
      source: event.source,
    });

    if (!loanId || !reminderType) {
      console.error("[ReminderProcessor] Invalid event payload: missing loanId or reminderType");
      return {
        statusCode: 400,
        loanId: loanId ?? "unknown",
        reminderType: reminderType ?? "upcoming_due",
        action: "failed",
        reason: "Invalid event payload",
        isSimulated,
      };
    }

    // 1. Authoritative re-read from DynamoDB
    const loan = await this.repo.getLoan(loanId);

    // 2. Evaluate business rules and idempotency
    const decision = evaluateReminderDecision(loan, reminderType, scheduledFor, isSimulated);

    if (!decision.shouldSend) {
      console.info("[ReminderProcessor] Skipped notification:", {
        loanId,
        reminderType,
        skipReason: decision.skipReason,
        currentStatus: loan?.status,
      });

      // If loan exists, record skip in notification history so audit trails remain clear
      if (loan) {
        const historyRecord: LoanReminderRecord = {
          scheduledFor,
          status: "skipped",
          skipReason: decision.skipReason,
        };

        const updatedLoan: Loan = {
          ...loan,
          notificationHistory: {
            ...loan.notificationHistory,
            [reminderType]: historyRecord,
          },
        };
        await this.repo.updateLoan(updatedLoan);
      }

      return {
        statusCode: 200,
        loanId,
        reminderType,
        action: "skipped",
        reason: decision.skipReason,
        isSimulated,
      };
    }

    const payload = decision.notificationPayload!;

    // 3. Dispatch notification via SNS
    let publishResult: { messageId: string; delivered: boolean; isSimulated: boolean };
    try {
      publishResult = await this.publisher.publishReminder({
        recipientEmail: payload.recipientEmail,
        subject: payload.subject,
        body: payload.body,
        structuredMessage: payload.structuredMessage,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Notification dispatch failed";
      console.error("[ReminderProcessor] Failed to publish notification:", {
        loanId,
        reminderType,
        error: errorMsg,
      });

      // Record failed attempt in loan history without corrupting core loan status
      if (loan) {
        const failureRecord: LoanReminderRecord = {
          scheduledFor,
          status: "failed",
          skipReason: errorMsg,
        };
        const updatedLoan: Loan = {
          ...loan,
          notificationHistory: {
            ...loan.notificationHistory,
            [reminderType]: failureRecord,
          },
        };
        await this.repo.updateLoan(updatedLoan);
      }

      return {
        statusCode: 500,
        loanId,
        reminderType,
        action: "failed",
        reason: errorMsg,
        isSimulated,
      };
    }

    // 4. Record successful dispatch idempotently in DynamoDB
    const nowIso = new Date().toISOString();
    const sentRecord: LoanReminderRecord = {
      scheduledFor,
      sentAt: nowIso,
      status: "sent",
      messageId: publishResult.messageId,
    };

    const updatedLoan: Loan = {
      ...loan!,
      notificationHistory: {
        ...loan!.notificationHistory,
        [reminderType]: sentRecord,
      },
    };
    await this.repo.updateLoan(updatedLoan);

    console.info("[ReminderProcessor] Successfully processed notification:", {
      loanId,
      reminderType,
      messageId: publishResult.messageId,
      isSimulated: publishResult.isSimulated,
    });

    return {
      statusCode: 200,
      loanId,
      reminderType,
      action: "sent",
      messageId: publishResult.messageId,
      isSimulated: publishResult.isSimulated,
    };
  }
}

// Global Lambda singleton handler
let globalPublisher: INotificationPublisher | null = null;

export function getNotificationPublisher(): INotificationPublisher {
  if (!globalPublisher) {
    if (process.env["SIMULATION_MODE"] === "true" || process.env["NODE_ENV"] === "test") {
      globalPublisher = new SimulatedSnsPublisher();
    } else {
      globalPublisher = new AwsSnsNotificationPublisher();
    }
  }
  return globalPublisher;
}

export function setNotificationPublisher(pub: INotificationPublisher): void {
  globalPublisher = pub;
}

export async function handler(event: ScheduledReminderEvent): Promise<ReminderProcessorResult> {
  const repo = getRepository();
  const publisher = getNotificationPublisher();
  const processor = new ReminderProcessor(repo, publisher);
  return processor.processEvent(event);
}
