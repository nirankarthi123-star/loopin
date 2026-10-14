import { describe, it, expect, beforeEach } from "vitest";
import type { Loan, Item } from "@loopin/shared";
import { setRepository } from "@loopin/backend/repository/factory.js";
import { MemoryRepository } from "@loopin/backend/repository/memory.repository.js";
import { LoansService } from "@loopin/backend/services/loans.service.js";
import {
  SimulatedSchedulerService,
  SimulatedSnsPublisher,
} from "@loopin/backend/services/notifications.service.js";
import { ReminderProcessor } from "@loopin/backend/handlers/reminders.js";
import type { ScheduledReminderEvent } from "@loopin/backend/domain/reminders.js";
import {
  calculateUpcomingReminderTime,
  calculateOverdueReminderTime,
  formatCampusDisplayDate,
} from "@loopin/backend/domain/reminders.js";

describe("LoopIn Automated Return Reminders — Comprehensive Engine Suite", () => {
  let memoryRepo: MemoryRepository;
  let simulatedScheduler: SimulatedSchedulerService;
  let simulatedPublisher: SimulatedSnsPublisher;
  let loansService: LoansService;
  let reminderProcessor: ReminderProcessor;

  const mockUserBorrower = {
    userId: "user-borrower-01",
    email: "niranjna.karthikeyan@vit.ac.in",
    displayName: "Niranjna Karthikeyan",
  };

  const mockUserLender = {
    userId: "user-lender-02",
    email: "arjun.lender@vit.ac.in",
    displayName: "Arjun Nair",
  };

  const baseItem: Item = {
    itemId: "item-reminder-test-1",
    ownerId: "user-lender-02",
    ownerName: "Arjun Nair",
    title: "Graphing Calculator TI-84 Plus CE",
    description: "High performance calculator.",
    category: "electronics",
    estimatedValue: 120,
    status: "available",
    condition: "like_new",
    tags: ["calculator", "math"],
    campusId: "campus-vit-chennai",
    pickupLocation: "Hostel Sharavathi",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    memoryRepo = new MemoryRepository(false);
    setRepository(memoryRepo);

    simulatedScheduler = new SimulatedSchedulerService();
    simulatedPublisher = new SimulatedSnsPublisher();

    loansService = new LoansService(memoryRepo, simulatedScheduler);
    reminderProcessor = new ReminderProcessor(memoryRepo, simulatedPublisher);

    await memoryRepo.createItem(baseItem);
  });

  const createActiveLoan = async (dueDateIso: string): Promise<Loan> => {
    const loan = await loansService.requestLoan(
      {
        itemId: baseItem.itemId,
        dueDate: dueDateIso,
        borrowerNote: "Need for calculus midterms",
        wouldHavePurchased: true,
      },
      mockUserBorrower,
    );

    await loansService.approveLoan(loan.loanId, mockUserLender);
    const active = await loansService.pickupLoan(loan.loanId, mockUserBorrower);
    return active;
  };

  describe("1. Workflow: Scheduling upon Pickup & Calculation Rules", () => {
    it("should compute accurate reminder offsets and format campus display dates in IST", () => {
      const now = new Date("2026-10-15T10:00:00Z");
      const dueDate = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(); // 3 days later
      const upcoming = calculateUpcomingReminderTime(dueDate, now.toISOString());
      const overdue = calculateOverdueReminderTime(dueDate);

      // Upcoming should be 24 hours before dueDate
      const expectedUpcomingTime = new Date(dueDate).getTime() - 24 * 60 * 60 * 1000;
      expect(new Date(upcoming).getTime()).toBe(expectedUpcomingTime);
      expect(overdue).toBe(dueDate);

      const formatted = formatCampusDisplayDate(dueDate);
      expect(formatted).toContain("IST");
    });

    it("should schedule upcoming and overdue reminders when a loan becomes active (pickup)", async () => {
      const dueDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      const activeLoan = await createActiveLoan(dueDate);

      expect(activeLoan.status).toBe("borrowed");
      expect(activeLoan.reminderSchedules?.upcomingScheduleName).toBeDefined();
      expect(activeLoan.reminderSchedules?.overdueScheduleName).toBeDefined();

      const registered = simulatedScheduler.getAllSchedules();
      expect(registered.length).toBe(2);
      expect(registered.map((s) => s.reminderType)).toContain("upcoming_due");
      expect(registered.map((s) => s.reminderType)).toContain("overdue");
    });
  });

  describe("2. Re-read Authoritative DynamoDB Record & Skip Inactive Loans", () => {
    it("should skip notifications if loan has been completed/returned", async () => {
      const dueDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const activeLoan = await createActiveLoan(dueDate);

      // Return the loan
      await loansService.confirmReturnLoan(activeLoan.loanId, mockUserLender);

      const event: ScheduledReminderEvent = {
        version: "1.0",
        source: "loopin.scheduler",
        detailType: "LoanReturnReminder",
        time: new Date().toISOString(),
        detail: {
          loanId: activeLoan.loanId,
          reminderType: "upcoming_due",
          scheduledFor: new Date().toISOString(),
          correlationId: "test-corr-1",
        },
      };

      const result = await reminderProcessor.processEvent(event);
      expect(result.action).toBe("skipped");
      expect(result.reason).toBe("already_completed");
      expect(simulatedPublisher.getDispatched().length).toBe(0);
    });

    it("should skip notifications if loan was cancelled", async () => {
      // Create pending loan then cancel it
      const loan = await loansService.requestLoan(
        {
          itemId: baseItem.itemId,
          dueDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        },
        mockUserBorrower,
      );
      await loansService.cancelLoan(loan.loanId, mockUserBorrower);

      const event: ScheduledReminderEvent = {
        version: "1.0",
        source: "loopin.scheduler",
        detailType: "LoanReturnReminder",
        time: new Date().toISOString(),
        detail: {
          loanId: loan.loanId,
          reminderType: "upcoming_due",
          scheduledFor: new Date().toISOString(),
          correlationId: "test-corr-cancel",
        },
      };

      const result = await reminderProcessor.processEvent(event);
      expect(result.action).toBe("skipped");
      expect(result.reason).toBe("already_cancelled");
      expect(simulatedPublisher.getDispatched().length).toBe(0);
    });

    it("should skip notifications if loan does not exist in repository", async () => {
      const event: ScheduledReminderEvent = {
        version: "1.0",
        source: "loopin.scheduler",
        detailType: "LoanReturnReminder",
        time: new Date().toISOString(),
        detail: {
          loanId: "non-existent-loan-id",
          reminderType: "upcoming_due",
          scheduledFor: new Date().toISOString(),
          correlationId: "test-corr-missing",
        },
      };

      const result = await reminderProcessor.processEvent(event);
      expect(result.action).toBe("skipped");
      expect(result.reason).toBe("loan_not_found");
    });
  });

  describe("3. Idempotency & Duplicate Invocation Protection", () => {
    it("should prevent duplicate notifications when EventBridge or Lambda retries", async () => {
      const dueDate = new Date(Date.now() + 20 * 3600 * 1000).toISOString();
      const activeLoan = await createActiveLoan(dueDate);

      const event: ScheduledReminderEvent = {
        version: "1.0",
        source: "loopin.scheduler",
        detailType: "LoanReturnReminder",
        time: new Date().toISOString(),
        detail: {
          loanId: activeLoan.loanId,
          reminderType: "upcoming_due",
          scheduledFor: new Date().toISOString(),
          correlationId: "test-corr-first",
        },
      };

      // 1st invocation: sends successfully
      const firstResult = await reminderProcessor.processEvent(event);
      expect(firstResult.action).toBe("sent");
      expect(simulatedPublisher.getDispatched().length).toBe(1);

      // Verify DynamoDB record now records the sent notification
      const storedLoan = await memoryRepo.getLoan(activeLoan.loanId);
      expect(storedLoan?.notificationHistory?.upcoming_due?.status).toBe("sent");
      expect(storedLoan?.notificationHistory?.upcoming_due?.sentAt).toBeDefined();

      // 2nd retry invocation with same or new correlation ID
      const retryEvent = { ...event, detail: { ...event.detail, attempt: 2 } };
      const retryResult = await reminderProcessor.processEvent(retryEvent);

      expect(retryResult.action).toBe("skipped");
      expect(retryResult.reason).toBe("already_sent");
      // Still only 1 notification was ever dispatched!
      expect(simulatedPublisher.getDispatched().length).toBe(1);
    });
  });

  describe("4. Due Date Updates & Schedule Lifecycle", () => {
    it("should cancel old schedules and register replacement schedules when due date changes", async () => {
      const initialDueDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      const activeLoan = await createActiveLoan(initialDueDate);

      const originalUpcomingSchedule = activeLoan.reminderSchedules?.upcomingScheduleName;
      expect(originalUpcomingSchedule).toBeDefined();

      // Borrower requests extension: 5 days later
      const newDueDate = new Date(Date.now() + 120 * 3600 * 1000).toISOString();
      const updatedLoan = await loansService.updateDueDate(
        activeLoan.loanId,
        newDueDate,
        mockUserBorrower,
      );

      expect(updatedLoan.dueDate).toBe(newDueDate);

      // Check that initial schedule was cancelled in the scheduler
      const oldSchedule = await simulatedScheduler.getSchedule(originalUpcomingSchedule!);
      expect(oldSchedule?.status).toBe("CANCELLED");
    });

    it("should cancel schedules upon return confirmation", async () => {
      const dueDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      const activeLoan = await createActiveLoan(dueDate);
      const upcomingSchedule = activeLoan.reminderSchedules?.upcomingScheduleName!;

      await loansService.confirmReturnLoan(activeLoan.loanId, mockUserLender);

      const status = await simulatedScheduler.getSchedule(upcomingSchedule);
      expect(status?.status).toBe("CANCELLED");
    });
  });

  describe("5. SNS Publishing & Notification Failures Handling", () => {
    it("should handle SNS dispatch errors gracefully without corrupting loan state", async () => {
      const dueDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const activeLoan = await createActiveLoan(dueDate);

      // Simulate SNS transient network failure
      simulatedPublisher.failNext = true;

      const event: ScheduledReminderEvent = {
        version: "1.0",
        source: "loopin.scheduler",
        detailType: "LoanReturnReminder",
        time: new Date().toISOString(),
        detail: {
          loanId: activeLoan.loanId,
          reminderType: "upcoming_due",
          scheduledFor: new Date().toISOString(),
          correlationId: "test-corr-fail",
        },
      };

      const result = await reminderProcessor.processEvent(event);
      expect(result.action).toBe("failed");
      expect(result.reason).toContain("Simulated SNS");

      // Verify loan record remained intact and marked as failed in notification history
      const storedLoan = await memoryRepo.getLoan(activeLoan.loanId);
      expect(storedLoan?.status).toBe("borrowed"); // Not corrupted
      expect(storedLoan?.notificationHistory?.upcoming_due?.status).toBe("failed");
    });

    it("should format notification messages with [SIMULATED DEMO] label when in simulation mode", async () => {
      const dueDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const activeLoan = await createActiveLoan(dueDate);

      const event: ScheduledReminderEvent = {
        version: "1.0",
        source: "loopin.simulator",
        detailType: "LoanReturnReminder",
        time: new Date().toISOString(),
        detail: {
          loanId: activeLoan.loanId,
          reminderType: "upcoming_due",
          scheduledFor: new Date().toISOString(),
          correlationId: "test-sim-label",
        },
      };

      const result = await reminderProcessor.processEvent(event);
      expect(result.action).toBe("sent");

      const dispatched = simulatedPublisher.getDispatched();
      expect(dispatched.length).toBe(1);
      expect(dispatched[0].subject).toContain("[SIMULATED DEMO]");
      expect(dispatched[0].body).toContain("simulated demonstration notification");
    });
  });
});
