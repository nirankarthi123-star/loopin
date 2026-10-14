import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DynamoDbRepository } from "@loopin/backend/repository/dynamodb.repository.js";
import {
  AwsEventBridgeSchedulerService,
  AwsSnsNotificationPublisher,
} from "@loopin/backend/services/notifications.service.js";
import { LoansService } from "@loopin/backend/services/loans.service.js";
import { ReminderProcessor } from "@loopin/backend/handlers/reminders.js";
import { MemoryRepository } from "@loopin/backend/repository/memory.repository.js";
import { ConflictError, NotFoundError } from "@loopin/backend/domain/errors.js";
import type { Item, Loan } from "@loopin/shared";
import { ddb } from "@loopin/backend/lib/dynamodb.js";
import { SchedulerClient } from "@aws-sdk/client-scheduler";
import { SNSClient } from "@aws-sdk/client-sns";

describe("AWS Real Services Integration Suite (Mocked SDK v3)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AWS_REGION: "us-east-1",
      DYNAMODB_TABLE_NAME: "loopin-test-table",
      SNS_TOPIC_ARN: "arn:aws:sns:us-east-1:123456789012:loopin-notifications-test",
      REMINDER_SCHEDULE_GROUP: "loopin-reminders-test",
      REMINDER_LAMBDA_ARN: "arn:aws:lambda:us-east-1:123456789012:function:loopin-reminders-test",
      SCHEDULER_EXECUTION_ROLE_ARN: "arn:aws:iam::123456789012:role/loopin-scheduler-role-test",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Amazon DynamoDB Repository Tests
  // ═══════════════════════════════════════════════════════════════════════════
  describe("1. Amazon DynamoDB Repository Operations", () => {
    const testItem: Item = {
      itemId: "item-dynamo-001",
      ownerId: "user-owner-001",
      ownerName: "Niranjna Karthikeyan",
      title: "TI-84 Plus Graphing Calculator",
      description: "Exam-ready graphing calculator with python support",
      category: "electronics",
      condition: "like_new",
      estimatedValue: 120,
      status: "available",
      tags: ["math", "calculator"],
      campusId: "campus-vit-chennai",
      pickupLocation: "Hostel D Block",
      createdAt: "2026-10-10T10:00:00.000Z",
      updatedAt: "2026-10-10T10:00:00.000Z",
    };

    it("should write item and user ownership pointer atomically via TransactWriteCommand", async () => {
      const sendSpy = vi.spyOn(ddb, "send").mockResolvedValueOnce({} as any);
      const repo = new DynamoDbRepository();

      const created = await repo.createItem(testItem);
      expect(created.itemId).toBe("item-dynamo-001");
      expect(sendSpy).toHaveBeenCalledTimes(1);

      const callArg = sendSpy.mock.calls[0]![0] as any;
      expect(callArg.input.TransactItems).toHaveLength(2);
      expect(callArg.input.TransactItems[0].Put.Item.PK).toBe("ITEM#item-dynamo-001");
      expect(callArg.input.TransactItems[0].Put.Item.SK).toBe("METADATA");
      expect(callArg.input.TransactItems[1].Put.Item.PK).toBe("USER#user-owner-001");
      expect(callArg.input.TransactItems[1].Put.Item.SK).toBe("ITEM#item-dynamo-001");
    });

    it("should retrieve item by PK and SK and clean internal partition keys", async () => {
      vi.spyOn(ddb, "send").mockResolvedValueOnce({
        Item: {
          PK: "ITEM#item-dynamo-001",
          SK: "METADATA",
          itemStatusSK: "STATUS#available#CREATED#2026-10-10T10:00:00.000Z",
          ...testItem,
        },
      } as any);

      const repo = new DynamoDbRepository();
      const item = await repo.getItem("item-dynamo-001");

      expect(item).not.toBeNull();
      expect(item?.itemId).toBe("item-dynamo-001");
      expect((item as any).PK).toBeUndefined();
      expect((item as any).itemStatusSK).toBeUndefined();
    });

    it("should list items by querying GSI1-Campus-Items index", async () => {
      vi.spyOn(ddb, "send").mockResolvedValueOnce({
        Items: [
          {
            PK: "ITEM#item-dynamo-001",
            SK: "METADATA",
            itemStatusSK: "STATUS#available#CREATED#2026-10-10T10:00:00.000Z",
            ...testItem,
          },
        ],
      } as any);

      const repo = new DynamoDbRepository();
      const result = await repo.listItems({
        campusId: "campus-vit-chennai",
        status: "available",
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.title).toBe("TI-84 Plus Graphing Calculator");
    });

    it("should delete item and owner reference atomically", async () => {
      // First call gets item, second call sends TransactWrite
      vi.spyOn(ddb, "send")
        .mockResolvedValueOnce({
          Item: {
            PK: "ITEM#item-dynamo-001",
            SK: "METADATA",
            ...testItem,
          },
        } as any)
        .mockResolvedValueOnce({} as any);

      const repo = new DynamoDbRepository();
      await repo.deleteItem("item-dynamo-001");

      expect(ddb.send).toHaveBeenCalledTimes(2);
    });

    it("should handle TransactionCanceledException on loan approval race conditions", async () => {
      const error = new Error("Conditional check failed");
      error.name = "TransactionCanceledException";

      // Mock getLoan returning pending loan
      vi.spyOn(ddb, "send")
        .mockResolvedValueOnce({
          Item: {
            loanId: "loan-race-001",
            status: "pending",
            requestedAt: "2026-10-10T10:00:00.000Z",
          },
        } as any)
        .mockRejectedValueOnce(error);

      const repo = new DynamoDbRepository();
      await expect(
        repo.atomicApproveLoan("loan-race-001", "item-001", "2026-10-10T10:05:00.000Z"),
      ).rejects.toThrow(ConflictError);
    });

    it("should write user account, email lookup, and initial profile atomically to DynamoDB", async () => {
      const sendSpy = vi.spyOn(ddb, "send").mockResolvedValueOnce({} as any);
      const repo = new DynamoDbRepository();

      await repo.createAccount({
        userId: "user-ddb-001",
        email: "test.student@vit.ac.in",
        passwordHash: "deadbeef",
        salt: "cafebabe",
        displayName: "Test Student",
        campusId: "campus-vit-chennai",
        emailVerified: false,
        createdAt: "2026-10-10T10:00:00.000Z",
        updatedAt: "2026-10-10T10:00:00.000Z",
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const callArg = sendSpy.mock.calls[0]![0] as any;
      expect(callArg.input.TransactItems).toHaveLength(3);
      expect(callArg.input.TransactItems[0].Put.Item.PK).toBe("EMAIL#test.student@vit.ac.in");
      expect(callArg.input.TransactItems[1].Put.Item.PK).toBe("USER#user-ddb-001");
      expect(callArg.input.TransactItems[1].Put.Item.SK).toBe("ACCOUNT");
      expect(callArg.input.TransactItems[2].Put.Item.PK).toBe("USER#user-ddb-001");
      expect(callArg.input.TransactItems[2].Put.Item.SK).toBe("PROFILE");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Amazon EventBridge Scheduler Integration Tests
  // ═══════════════════════════════════════════════════════════════════════════
  describe("2. Amazon EventBridge Scheduler Integration", () => {
    it("should create schedule with valid expression, short compliant name, and deletion policy", async () => {
      const sendSpy = vi.spyOn(SchedulerClient.prototype, "send").mockResolvedValueOnce({} as any);

      const scheduler = new AwsEventBridgeSchedulerService();
      const futureTime = new Date(Date.now() + 86400000).toISOString(); // +24 hours

      const res = await scheduler.scheduleReminder({
        loanId: "loan-12345678-abcd-ef01-2345-6789abcdef01",
        reminderType: "upcoming_due",
        scheduledTimeIso: futureTime,
      });

      expect(res.scheduleName).toBeDefined();
      expect(res.scheduleName.length).toBeLessThanOrEqual(64);
      expect(res.scheduleName).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(sendSpy).toHaveBeenCalledTimes(1);

      const command = sendSpy.mock.calls[0]![0] as any;
      expect(command.input.GroupName).toBe("loopin-reminders-test");
      expect(command.input.ActionAfterCompletion).toBe("DELETE");
      expect(command.input.FlexibleTimeWindow.Mode).toBe("OFF");
      expect(command.input.ScheduleExpression).toMatch(/^at\(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\)$/);
    });

    it("should safely handle past schedule times without calling CreateSchedule", async () => {
      const sendSpy = vi.spyOn(SchedulerClient.prototype, "send");
      const scheduler = new AwsEventBridgeSchedulerService();

      const pastTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const res = await scheduler.scheduleReminder({
        loanId: "loan-past-001",
        reminderType: "overdue",
        scheduledTimeIso: pastTime,
      });

      expect(res.scheduleName).toContain("expired-overdue");
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it("should be idempotent when ConflictException occurs on duplicate schedule", async () => {
      const conflictError = new Error("Schedule already exists");
      conflictError.name = "ConflictException";

      vi.spyOn(SchedulerClient.prototype, "send").mockRejectedValueOnce(conflictError);

      const scheduler = new AwsEventBridgeSchedulerService();
      const futureTime = new Date(Date.now() + 86400000).toISOString();

      const res = await scheduler.scheduleReminder({
        loanId: "loan-dup-001",
        reminderType: "upcoming_due",
        scheduledTimeIso: futureTime,
      });

      expect(res.scheduleName).toBeDefined();
    });

    it("should delete schedule when loan is returned or cancelled", async () => {
      const sendSpy = vi.spyOn(SchedulerClient.prototype, "send").mockResolvedValueOnce({} as any);

      const scheduler = new AwsEventBridgeSchedulerService();
      const success = await scheduler.cancelReminder("lp-test-schedule-123456");

      expect(success).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Amazon SNS Publisher Tests
  // ═══════════════════════════════════════════════════════════════════════════
  describe("3. Amazon SNS Publisher Operations", () => {
    it("should publish reminder message to configured SNS_TOPIC_ARN", async () => {
      const sendSpy = vi.spyOn(SNSClient.prototype, "send").mockResolvedValueOnce({
        MessageId: "sns-msg-999888",
      } as any);

      const publisher = new AwsSnsNotificationPublisher();
      const result = await publisher.publishReminder({
        subject: "LoopIn Reminder: Return Due",
        body: "Your calculator is due tomorrow.",
        structuredMessage: {
          loanId: "loan-sns-001",
          reminderType: "upcoming_due",
        },
      });

      expect(result.delivered).toBe(true);
      expect(result.messageId).toBe("sns-msg-999888");
      expect(result.isSimulated).toBe(false);

      const call = sendSpy.mock.calls[0]![0] as any;
      expect(call.input.TopicArn).toBe("arn:aws:sns:us-east-1:123456789012:loopin-notifications-test");
      expect(call.input.Message).toBe("Your calculator is due tomorrow.");
    });

    it("should throw error when neither SNS_TOPIC_ARN nor NOTIFICATIONS_TOPIC_ARN is configured", async () => {
      delete process.env["SNS_TOPIC_ARN"];
      delete process.env["NOTIFICATIONS_TOPIC_ARN"];

      const publisher = new AwsSnsNotificationPublisher();
      await expect(
        publisher.publishReminder({
          subject: "Test",
          body: "Test body",
          structuredMessage: {},
        }),
      ).rejects.toThrow(/SNS_TOPIC_ARN/);
    });

    it("should handle SNS publish failures without crashing unhandled", async () => {
      vi.spyOn(SNSClient.prototype, "send").mockRejectedValueOnce(
        new Error("SNS Service Unavailable"),
      );

      const publisher = new AwsSnsNotificationPublisher();
      await expect(
        publisher.publishReminder({
          subject: "Test",
          body: "Test body",
          structuredMessage: { loanId: "loan-fail-1", reminderType: "upcoming_due" },
        }),
      ).rejects.toThrow("SNS Service Unavailable");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Complete Workflow: Partial Failure Handling & Idempotency
  // ═══════════════════════════════════════════════════════════════════════════
  describe("4. Complete Workflow Partial Failure & Idempotency", () => {
    it("should record pending reconciliation when scheduler fails after DynamoDB pickup succeeds", async () => {
      const repo = new MemoryRepository(false);
      const testItem: Item = {
        itemId: "item-flow-1",
        ownerId: "user-lender",
        ownerName: "Lender User",
        title: "Microbiology Lab Coat",
        description: "White lab coat size M",
        category: "clothing",
        estimatedValue: 40,
        status: "available",
        condition: "good",
        tags: ["lab"],
        campusId: "campus-vit-chennai",
        pickupLocation: "SJ Block",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await repo.createItem(testItem);

      // Faulty scheduler that fails
      const faultyScheduler = {
        scheduleReminder: vi.fn().mockRejectedValue(new Error("Scheduler quota exceeded")),
        cancelReminder: vi.fn().mockResolvedValue(true),
        getSchedule: vi.fn().mockResolvedValue(null),
      };

      const loansService = new LoansService(repo, faultyScheduler);
      const borrower = { userId: "user-borrower", email: "borrower@vit.ac.in", displayName: "Borrower" };
      const lender = { userId: "user-lender", email: "lender@vit.ac.in", displayName: "Lender" };

      const loan = await loansService.requestLoan(
        { itemId: "item-flow-1", dueDate: new Date(Date.now() + 86400000).toISOString() },
        borrower,
      );
      await loansService.approveLoan(loan.loanId, lender);

      // Pickup succeeds in DynamoDB even though scheduler failed; status is recorded as pending_reconcile
      const pickedUp = await loansService.pickupLoan(loan.loanId, borrower);
      expect(pickedUp.status).toBe("borrowed");
      expect(pickedUp.reminderSchedules?.upcomingScheduleName).toBe("pending_reconcile");

      // Verify reconciliation recovers the schedule once scheduler is operational
      const healthyScheduler = {
        scheduleReminder: vi.fn().mockResolvedValue({ scheduleName: "lp-reconciled-schedule-1" }),
        cancelReminder: vi.fn().mockResolvedValue(true),
        getSchedule: vi.fn().mockResolvedValue(null),
      };
      const reconcileService = new LoansService(repo, healthyScheduler);
      const reconciled = await reconcileService.reconcileLoanSchedules(loan.loanId, borrower);

      expect(reconciled.reminderSchedules?.upcomingScheduleName).toBe("lp-reconciled-schedule-1");
    });

    it("should ensure reminder processor Lambda is strictly idempotent on duplicate invocations", async () => {
      const repo = new MemoryRepository(false);
      const loan: Loan = {
        loanId: "loan-idem-001",
        itemId: "item-idem-001",
        itemTitle: "Arduino Uno Kit",
        borrowerId: "user-b",
        borrowerName: "Student B",
        lenderId: "user-l",
        lenderName: "Student L",
        status: "borrowed",
        requestedAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        durationDays: 1,
        rentalFee: 2,
        savingsValue: 35,
        wouldHavePurchased: true,
      };
      await repo.createLoan(loan);

      const publisher = {
        publishReminder: vi.fn().mockResolvedValue({
          messageId: "sns-idem-first",
          delivered: true,
          isSimulated: false,
        }),
      };

      const processor = new ReminderProcessor(repo, publisher);

      const event = {
        version: "1.0",
        source: "loopin.scheduler" as const,
        detailType: "LoanReturnReminder" as const,
        time: new Date().toISOString(),
        detail: {
          loanId: "loan-idem-001",
          reminderType: "upcoming_due" as const,
          scheduledFor: new Date().toISOString(),
          correlationId: "corr-1",
        },
      };

      // First invocation sends notification
      const firstResult = await processor.processEvent(event);
      expect(firstResult.action).toBe("sent");
      expect(firstResult.messageId).toBe("sns-idem-first");
      expect(publisher.publishReminder).toHaveBeenCalledTimes(1);

      // Second invocation (retry from EventBridge) skips cleanly due to idempotency record
      const secondResult = await processor.processEvent(event);
      expect(secondResult.action).toBe("skipped");
      expect(secondResult.reason).toBe("already_sent");
      expect(publisher.publishReminder).toHaveBeenCalledTimes(1); // Not called again!
    });
  });
});
