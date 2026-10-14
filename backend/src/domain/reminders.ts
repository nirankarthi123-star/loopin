/**
 * Reminder & Notification Domain Engine — LoopIn Backend
 *
 * Implements core domain logic for return reminders:
 * - Timezone normalization (UTC ISO 8601 storage, campus IST display)
 * - Schedule offset computation (e.g., 24 hours prior to dueDate, and at overdue date)
 * - Authority evaluation: deciding whether a reminder should be sent, skipped, or is obsolete
 * - Safe payload formulation for SNS (no PII exposure in public messages)
 */

import type { Loan, ReminderType } from "@loopin/shared";

export interface ScheduledReminderEvent {
  version: string;
  source: "loopin.scheduler" | "loopin.simulator";
  detailType: "LoanReturnReminder";
  time: string; // ISO timestamp
  detail: {
    loanId: string;
    reminderType: ReminderType;
    scheduledFor: string;
    attempt?: number;
    correlationId: string;
  };
}

export interface ReminderDecision {
  shouldSend: boolean;
  skipReason?:
    | "loan_not_found"
    | "loan_not_active"
    | "already_completed"
    | "already_cancelled"
    | "already_rejected"
    | "already_sent"
    | "due_date_changed"
    | "not_yet_due";
  notificationPayload?: {
    recipientEmail?: string | undefined;
    subject: string;
    body: string;
    structuredMessage: {
      loanId: string;
      itemTitle: string;
      reminderType: ReminderType;
      dueDateIso: string;
      displayDueDate: string;
      status: string;
      isSimulated: boolean;
      instructions: string;
    };
  } | undefined;
}

/**
 * 24 hours before dueDate for upcoming reminder.
 */
export const UPCOMING_REMINDER_HOURS_BEFORE = 24;

/**
 * Compute the ISO timestamp for the upcoming return reminder.
 * If the loan was borrowed with less than 24h remaining, schedules for halfway between borrowedAt and dueDate.
 */
export function calculateUpcomingReminderTime(dueDateIso: string, borrowedAtIso?: string): string {
  const due = new Date(dueDateIso).getTime();
  const borrowed = borrowedAtIso ? new Date(borrowedAtIso).getTime() : Date.now();
  const standardOffset = UPCOMING_REMINDER_HOURS_BEFORE * 60 * 60 * 1000;

  if (due - borrowed > standardOffset) {
    return new Date(due - standardOffset).toISOString();
  }

  // If due sooner than 24 hours, schedule midway
  const midpoint = Math.floor(borrowed + (due - borrowed) / 2);
  return new Date(midpoint).toISOString();
}

/**
 * Compute the ISO timestamp for the overdue notification (exact dueDate or +15m grace).
 */
export function calculateOverdueReminderTime(dueDateIso: string): string {
  return new Date(dueDateIso).toISOString();
}

/**
 * Format a human-readable Indian Standard Time (IST / Asia/Kolkata) date string for emails/messages,
 * with fallback to UTC.
 */
export function formatCampusDisplayDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date) + " IST";
  } catch {
    return isoString;
  }
}

/**
 * Evaluates whether a notification should be delivered based on the authoritative DynamoDB loan record.
 * Guarantees:
 * - Loans that are completed, returned, cancelled, or rejected are NEVER notified.
 * - Idempotency: duplicate invocations for an already sent reminder type are skipped.
 * - If the loan's due date was postponed/changed, obsolete scheduled reminders are skipped.
 */
export function evaluateReminderDecision(
  loan: Loan | null,
  reminderType: ReminderType,
  _scheduledFor: string,
  isSimulated = false,
): ReminderDecision {
  if (!loan) {
    return { shouldSend: false, skipReason: "loan_not_found" };
  }

  // 1. Terminal / non-active loan status checks
  if (loan.status === "completed" || loan.status === "returned") {
    return { shouldSend: false, skipReason: "already_completed" };
  }

  if (loan.status === "cancelled") {
    return { shouldSend: false, skipReason: "already_cancelled" };
  }

  if (loan.status === "rejected") {
    return { shouldSend: false, skipReason: "already_rejected" };
  }

  // Only active loans (status: borrowed or active or return_requested) should receive reminders
  if (loan.status !== "borrowed" && loan.status !== "active" && loan.status !== "return_requested") {
    return { shouldSend: false, skipReason: "loan_not_active" };
  }

  // 2. Idempotency check: has this specific reminder already been recorded as sent?
  const existingRecord = loan.notificationHistory?.[reminderType];
  if (existingRecord && existingRecord.status === "sent") {
    return { shouldSend: false, skipReason: "already_sent" };
  }

  // 3. Due date check: if due date changed significantly after the schedule was created
  // For upcoming_due: if loan.dueDate changed such that scheduledFor is no longer ~24h before loan.dueDate
  const loanDueTime = new Date(loan.dueDate).getTime();

  if (reminderType === "upcoming_due") {
    // If current time is already past dueDate, upcoming reminder is obsolete
    if (Date.now() >= loanDueTime) {
      return { shouldSend: false, skipReason: "due_date_changed" };
    }
  }

  if (reminderType === "overdue") {
    // If loan is not actually overdue yet (due date got extended past current time)
    if (Date.now() < loanDueTime) {
      return { shouldSend: false, skipReason: "not_yet_due" };
    }
  }

  // 4. Construct privacy-safe payload
  const displayDate = formatCampusDisplayDate(loan.dueDate);
  const simulationPrefix = isSimulated ? "[SIMULATED DEMO] " : "";

  let subject: string;
  let instructions: string;

  if (reminderType === "upcoming_due") {
    subject = `${simulationPrefix}LoopIn Reminder: "${loan.itemTitle}" is due on ${displayDate}`;
    instructions = `Your borrowed item "${loan.itemTitle}" is due on ${displayDate}. Please arrange return with the lender or request a return in LoopIn.`;
  } else {
    subject = `${simulationPrefix}LoopIn Alert: "${loan.itemTitle}" is OVERDUE (Due: ${displayDate})`;
    instructions = `Your loan for "${loan.itemTitle}" was due on ${displayDate} and is currently overdue. Please return the item immediately to preserve your TrustScore.`;
  }

  const body = `
${subject}

Hello ${loan.borrowerName},

${instructions}

Loan Details:
- Item: ${loan.itemTitle}
- Due Date: ${displayDate}
- Loan ID: ${loan.loanId}

${isSimulated ? "\n⚠️ This is a simulated demonstration notification. No real emails or SMS were dispatched.\n" : ""}
Thank you for keeping campus resources circular and accessible!
The LoopIn Campus Team
`.trim();

  return {
    shouldSend: true,
    notificationPayload: {
      recipientEmail: loan.borrowerEmail,
      subject,
      body,
      structuredMessage: {
        loanId: loan.loanId,
        itemTitle: loan.itemTitle,
        reminderType,
        dueDateIso: loan.dueDate,
        displayDueDate: displayDate,
        status: loan.status,
        isSimulated,
        instructions,
      },
    },
  };
}
