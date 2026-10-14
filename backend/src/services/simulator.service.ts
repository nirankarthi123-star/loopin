/**
 * Simulated Reminder Controller & Test Harness — LoopIn Backend
 *
 * Provides developers and test suites with a deterministic simulator to:
 * 1. Inspect registered reminder schedules in memory without creating AWS EventBridge resources.
 * 2. Manually fire or trigger scheduled reminders at arbitrary test times.
 * 3. Inspect dispatched notifications without sending real emails or publishing to live SNS topics.
 * 4. Verify skip decisions (completed loans, cancelled loans, obsolete dates, duplicates).
 */

import { getRepository } from "../repository/factory.js";
import type { ReminderType } from "@loopin/shared";
import {
  SimulatedSchedulerService,
  SimulatedSnsPublisher,
  type SimulatedSchedule,
  type SimulatedDispatchedNotification,
} from "../services/notifications.service.js";
import { ReminderProcessor, type ReminderProcessorResult } from "../handlers/reminders.js";
import type { ScheduledReminderEvent } from "../domain/reminders.js";

export class SimulatedReminderHarness {
  public scheduler: SimulatedSchedulerService;
  public publisher: SimulatedSnsPublisher;
  public processor: ReminderProcessor;

  constructor() {
    this.scheduler = new SimulatedSchedulerService();
    this.publisher = new SimulatedSnsPublisher();
    const repo = getRepository();
    this.processor = new ReminderProcessor(repo, this.publisher);
  }

  /**
   * List all simulated schedules currently pending in the simulator.
   */
  listSchedules(): SimulatedSchedule[] {
    return this.scheduler.getAllSchedules();
  }

  /**
   * List all simulated notifications captured by the simulated SNS publisher.
   */
  listDispatchedNotifications(): SimulatedDispatchedNotification[] {
    return this.publisher.getDispatched();
  }

  /**
   * Simulate the arrival of a scheduled EventBridge invocation for a specific loan and reminder type.
   */
  async triggerReminder(
    loanId: string,
    reminderType: ReminderType,
    customScheduledFor?: string,
    attempt = 1,
  ): Promise<ReminderProcessorResult> {
    const scheduledFor = customScheduledFor ?? new Date().toISOString();

    const event: ScheduledReminderEvent = {
      version: "1.0",
      source: "loopin.simulator",
      detailType: "LoanReturnReminder",
      time: new Date().toISOString(),
      detail: {
        loanId,
        reminderType,
        scheduledFor,
        attempt,
        correlationId: `sim-run-${Date.now()}`,
      },
    };

    return this.processor.processEvent(event);
  }

  /**
   * Clear all simulated schedules and dispatched notifications.
   */
  reset(): void {
    this.scheduler.clear();
    this.publisher.clear();
  }
}
