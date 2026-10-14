/**
 * Loans Application Service — LoopIn Backend
 *
 * Implements business workflows for loan requests, state transitions,
 * concurrency protections, and permissions.
 */

import { v4 as uuidv4 } from "uuid";
import { type Loan, calculateRentalFee } from "@loopin/shared";
import type { ILoopInRepository } from "../repository/interface.js";
import type { CreateLoanInput, QueryLoansInput } from "../schemas/loans.schema.js";
import type { AuthenticatedUser } from "./items.service.js";
import {
  validateLoanTransition,
  validateNewLoanRequest,
  assertCanAccessLoan,
} from "../domain/loanLifecycle.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../domain/errors.js";
import {
  calculateUpcomingReminderTime,
  calculateOverdueReminderTime,
} from "../domain/reminders.js";
import {
  type ISchedulerService,
  AwsEventBridgeSchedulerService,
  SimulatedSchedulerService,
} from "./notifications.service.js";

let defaultScheduler: ISchedulerService | null = null;

export function getDefaultSchedulerService(): ISchedulerService {
  if (!defaultScheduler) {
    if (process.env["SIMULATION_MODE"] === "true" || process.env["NODE_ENV"] === "test") {
      defaultScheduler = new SimulatedSchedulerService();
    } else {
      defaultScheduler = new AwsEventBridgeSchedulerService();
    }
  }
  return defaultScheduler;
}

export function setDefaultSchedulerService(scheduler: ISchedulerService): void {
  defaultScheduler = scheduler;
}

export class LoansService {
  private scheduler: ISchedulerService;

  constructor(
    private readonly repo: ILoopInRepository,
    scheduler?: ISchedulerService,
  ) {
    this.scheduler = scheduler ?? getDefaultSchedulerService();
  }

  async requestLoan(input: CreateLoanInput, user: AuthenticatedUser): Promise<Loan> {
    const item = await this.repo.getItem(input.itemId);
    if (!item) {
      throw new NotFoundError("item", input.itemId);
    }

    // Check existing loans on item
    const existingLoans = await this.repo.listLoansByItem(input.itemId);

    // Enforce business rules: cannot borrow own item, item must be available, no conflicting loans
    validateNewLoanRequest(item, user.userId, existingLoans);

    const now = new Date().toISOString();
    const loanId = `loan-${uuidv4()}`;

    // Derive loan duration in days from dueDate vs now
    const durationDays = Math.max(
      1,
      Math.ceil((new Date(input.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    );

    // Rental fee: 0.5% of item cost per day, strictly capped below 15% of cost price (max 14%)
    const rentalFee = calculateRentalFee(item.estimatedValue, durationDays);

    const newLoan: Loan = {
      loanId,
      itemId: item.itemId,
      itemTitle: item.title,
      borrowerId: user.userId,
      borrowerName: user.displayName ?? user.email.split("@")[0] ?? "Student",
      lenderId: item.ownerId,
      lenderName: item.ownerName,
      status: "pending",
      requestedAt: now,
      dueDate: input.dueDate,
      durationDays,
      rentalFee,
      savingsValue: item.estimatedValue,
      wouldHavePurchased: input.wouldHavePurchased ?? true,
      ...(input.borrowerNote ? { borrowerNote: input.borrowerNote } : {}),
    };

    return this.repo.createLoan(newLoan);
  }

  async getLoan(loanId: string, user: AuthenticatedUser): Promise<Loan> {
    const loan = await this.repo.getLoan(loanId);
    if (!loan) {
      throw new NotFoundError("loan", loanId);
    }
    // Only authorized parties can access loan details
    assertCanAccessLoan(loan, user.userId);
    return loan;
  }

  async listMyLoans(user: AuthenticatedUser, query: QueryLoansInput): Promise<Loan[]> {
    return this.repo.listLoansForUser(user.userId, query.role, query.status);
  }

  async approveLoan(loanId: string, user: AuthenticatedUser): Promise<Loan> {
    const loan = await this.repo.getLoan(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    // Validate server-side transition & role (only lender can approve)
    validateLoanTransition(loan, "approve", user.userId);

    const now = new Date().toISOString();
    return this.repo.atomicApproveLoan(loanId, loan.itemId, now);
  }

  async rejectLoan(loanId: string, user: AuthenticatedUser): Promise<Loan> {
    const loan = await this.repo.getLoan(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    // Validate server-side transition & role (only lender can reject)
    const { nextStatus } = validateLoanTransition(loan, "reject", user.userId);

    const updatedLoan: Loan = {
      ...loan,
      status: nextStatus,
    };

    return this.repo.updateLoan(updatedLoan);
  }

  async pickupLoan(loanId: string, user: AuthenticatedUser): Promise<Loan> {
    const loan = await this.repo.getLoan(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    // Validate transition: approved -> borrowed (borrower or lender)
    validateLoanTransition(loan, "pickup", user.userId);

    const now = new Date().toISOString();
    const activeLoan = await this.repo.atomicPickupLoan(loanId, loan.itemId, now);

    // Schedule automated return reminders
    try {
      const upcomingTime = calculateUpcomingReminderTime(activeLoan.dueDate, activeLoan.borrowedAt);
      const overdueTime = calculateOverdueReminderTime(activeLoan.dueDate);

      const [upcomingRes, overdueRes] = await Promise.all([
        this.scheduler.scheduleReminder({
          loanId: activeLoan.loanId,
          reminderType: "upcoming_due",
          scheduledTimeIso: upcomingTime,
        }),
        this.scheduler.scheduleReminder({
          loanId: activeLoan.loanId,
          reminderType: "overdue",
          scheduledTimeIso: overdueTime,
        }),
      ]);

      const loanWithSchedules: Loan = {
        ...activeLoan,
        reminderSchedules: {
          upcomingScheduleName: upcomingRes.scheduleName,
          overdueScheduleName: overdueRes.scheduleName,
        },
      };

      return this.repo.updateLoan(loanWithSchedules);
    } catch (schedErr) {
      const errMsg = schedErr instanceof Error ? schedErr.message : String(schedErr);
      console.error("[LoansService] Partial failure: Loan picked up in DynamoDB but EventBridge schedule creation failed:", {
        loanId: activeLoan.loanId,
        error: errMsg,
      });

      // Mark schedules as pending reconciliation in DynamoDB so state is accurate
      const loanNeedingReconciliation: Loan = {
        ...activeLoan,
        reminderSchedules: {
          upcomingScheduleName: "pending_reconcile",
          overdueScheduleName: "pending_reconcile",
        },
      };

      try {
        await this.repo.updateLoan(loanNeedingReconciliation);
        return loanNeedingReconciliation;
      } catch {
        return activeLoan;
      }
    }
  }

  async requestReturnLoan(loanId: string, user: AuthenticatedUser): Promise<Loan> {
    const loan = await this.repo.getLoan(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    // Validate transition: borrowed -> return_requested (borrower)
    const { nextStatus } = validateLoanTransition(loan, "request_return", user.userId);

    const updatedLoan: Loan = {
      ...loan,
      status: nextStatus,
      returnRequestedAt: new Date().toISOString(),
    };

    return this.repo.updateLoan(updatedLoan);
  }

  async confirmReturnLoan(loanId: string, user: AuthenticatedUser): Promise<Loan> {
    const loan = await this.repo.getLoan(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    // Validate transition: return_requested / borrowed -> completed (lender)
    validateLoanTransition(loan, "confirm_return", user.userId);

    const now = new Date().toISOString();
    const completedLoan = await this.repo.atomicConfirmReturnLoan(loanId, loan.itemId, now);

    // Clean up EventBridge Schedules for completed loan
    if (loan.reminderSchedules?.upcomingScheduleName) {
      this.scheduler.cancelReminder(loan.reminderSchedules.upcomingScheduleName).catch(() => {});
    }
    if (loan.reminderSchedules?.overdueScheduleName) {
      this.scheduler.cancelReminder(loan.reminderSchedules.overdueScheduleName).catch(() => {});
    }

    return completedLoan;
  }

  async returnLoan(loanId: string, user: AuthenticatedUser): Promise<Loan> {
    return this.confirmReturnLoan(loanId, user);
  }

  async cancelLoan(loanId: string, user: AuthenticatedUser): Promise<Loan> {
    const loan = await this.repo.getLoan(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    // Validate transition: pending -> cancelled (borrower)
    const { nextStatus } = validateLoanTransition(loan, "cancel", user.userId);

    const updatedLoan: Loan = {
      ...loan,
      status: nextStatus,
    };

    if (loan.reminderSchedules?.upcomingScheduleName) {
      this.scheduler.cancelReminder(loan.reminderSchedules.upcomingScheduleName).catch(() => {});
    }
    if (loan.reminderSchedules?.overdueScheduleName) {
      this.scheduler.cancelReminder(loan.reminderSchedules.overdueScheduleName).catch(() => {});
    }

    return this.repo.updateLoan(updatedLoan);
  }

  async updateDueDate(loanId: string, newDueDateIso: string, user: AuthenticatedUser): Promise<Loan> {
    const loan = await this.repo.getLoan(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    // Only lender or borrower can negotiate due date change
    if (loan.lenderId !== user.userId && loan.borrowerId !== user.userId) {
      throw new ForbiddenError("Only loan participants can adjust due date");
    }

    if (loan.status === "completed" || loan.status === "cancelled" || loan.status === "rejected") {
      throw new ConflictError("Cannot modify due date for inactive loan");
    }

    // Cancel old schedules if they exist
    if (loan.reminderSchedules?.upcomingScheduleName) {
      await this.scheduler.cancelReminder(loan.reminderSchedules.upcomingScheduleName).catch(() => {});
    }
    if (loan.reminderSchedules?.overdueScheduleName) {
      await this.scheduler.cancelReminder(loan.reminderSchedules.overdueScheduleName).catch(() => {});
    }

    // If loan is currently borrowed, register replacement schedules for new due date
    let updatedSchedules = loan.reminderSchedules;
    if (loan.status === "borrowed" || loan.status === "active") {
      const upcomingTime = calculateUpcomingReminderTime(newDueDateIso, loan.borrowedAt);
      const overdueTime = calculateOverdueReminderTime(newDueDateIso);

      const [upcomingRes, overdueRes] = await Promise.all([
        this.scheduler.scheduleReminder({
          loanId: loan.loanId,
          reminderType: "upcoming_due",
          scheduledTimeIso: upcomingTime,
        }),
        this.scheduler.scheduleReminder({
          loanId: loan.loanId,
          reminderType: "overdue",
          scheduledTimeIso: overdueTime,
        }),
      ]);

      updatedSchedules = {
        upcomingScheduleName: upcomingRes.scheduleName,
        overdueScheduleName: overdueRes.scheduleName,
      };
    }

    const updatedLoan: Loan = {
      ...loan,
      dueDate: newDueDateIso,
      reminderSchedules: updatedSchedules,
    };

    return this.repo.updateLoan(updatedLoan);
  }

  async reconcileLoanSchedules(loanId: string, user: AuthenticatedUser): Promise<Loan> {
    const loan = await this.repo.getLoan(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    assertCanAccessLoan(loan, user.userId);

    if (loan.status !== "borrowed" && loan.status !== "active") {
      return loan;
    }

    const upcomingTime = calculateUpcomingReminderTime(loan.dueDate, loan.borrowedAt);
    const overdueTime = calculateOverdueReminderTime(loan.dueDate);

    const [upcomingRes, overdueRes] = await Promise.all([
      this.scheduler.scheduleReminder({
        loanId: loan.loanId,
        reminderType: "upcoming_due",
        scheduledTimeIso: upcomingTime,
      }),
      this.scheduler.scheduleReminder({
        loanId: loan.loanId,
        reminderType: "overdue",
        scheduledTimeIso: overdueTime,
      }),
    ]);

    const reconciledLoan: Loan = {
      ...loan,
      reminderSchedules: {
        upcomingScheduleName: upcomingRes.scheduleName,
        overdueScheduleName: overdueRes.scheduleName,
      },
    };

    return this.repo.updateLoan(reconciledLoan);
  }
}
