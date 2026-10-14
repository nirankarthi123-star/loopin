/**
 * Loan Lifecycle & Central Typed State Machine — LoopIn Backend
 *
 * State Machine:
 * - pending: Initial borrower request.
 * - approved: Lender accepted request.
 * - rejected: Lender declined pending request.
 * - borrowed (active): Explicit borrower/lender pickup confirmation. Item becomes unavailable.
 * - return_requested: Borrower indicated return ready.
 * - completed (returned): Explicit lender return receipt confirmation. Item returns to available.
 * - cancelled: Borrower cancelled pending loan.
 *
 * Overdue Status:
 * Dynamically derived when status is borrowed/active and current time > dueDate.
 */

import type { Loan, LoanStatus, Item } from "@loopin/shared";
import { ForbiddenError, ConflictError, BusinessRuleError } from "./errors.js";

export type LoanAction =
  | "approve"
  | "reject"
  | "pickup"
  | "request_return"
  | "confirm_return"
  | "cancel"
  // Legacy aliases
  | "return";

interface TransitionRule {
  from: LoanStatus[];
  to: LoanStatus;
  allowedRoles: Array<"lender" | "borrower">;
}

const TRANSITIONS: Record<LoanAction, TransitionRule> = {
  approve: {
    from: ["pending"],
    to: "approved",
    allowedRoles: ["lender"],
  },
  reject: {
    from: ["pending"],
    to: "rejected",
    allowedRoles: ["lender"],
  },
  pickup: {
    from: ["approved"],
    to: "borrowed",
    allowedRoles: ["lender", "borrower"],
  },
  request_return: {
    from: ["borrowed", "active"],
    to: "return_requested",
    allowedRoles: ["borrower"],
  },
  confirm_return: {
    from: ["return_requested", "borrowed", "active"],
    to: "completed",
    allowedRoles: ["lender"],
  },
  return: {
    // Backwards compatibility alias for confirm_return
    from: ["borrowed", "active", "return_requested"],
    to: "completed",
    allowedRoles: ["lender"],
  },
  cancel: {
    from: ["pending"],
    to: "cancelled",
    allowedRoles: ["borrower"],
  },
};

/**
 * Validates whether a loan can transition under the given action by the caller.
 */
export function validateLoanTransition(
  loan: Loan,
  action: LoanAction,
  callerUserId: string,
): { nextStatus: LoanStatus } {
  const rule = TRANSITIONS[action];
  if (!rule) {
    throw new BusinessRuleError(`Unrecognized loan action: '${action}'`);
  }

  // 1. Validate caller role permission
  const isLender = loan.lenderId === callerUserId;
  const isBorrower = loan.borrowerId === callerUserId;

  if (!isLender && !isBorrower) {
    throw new ForbiddenError("You are not a participant in this loan agreement");
  }

  const callerRole = isLender ? "lender" : "borrower";
  if (!rule.allowedRoles.includes(callerRole)) {
    throw new ForbiddenError(
      `Only the ${rule.allowedRoles.join(" or ")} may perform the '${action}' action on this loan`,
    );
  }

  // 2. Normalize and check status
  const currentStatus = loan.status === "active" ? "borrowed" : loan.status === "returned" ? "completed" : loan.status;

  const isAllowedState = rule.from.includes(loan.status) || rule.from.includes(currentStatus);
  if (!isAllowedState) {
    throw new ConflictError(
      `Cannot '${action}' loan: current status is '${loan.status}', but must be one of [${rule.from.join(", ")}]`,
      { currentStatus: loan.status, requiredStatus: rule.from },
    );
  }

  return { nextStatus: rule.to };
}

/**
 * Helper to determine whether a loan is overdue based on due date.
 */
export function isLoanOverdue(loan: Loan, referenceTimestamp = Date.now()): boolean {
  const isBorrowed = loan.status === "borrowed" || loan.status === "active" || loan.status === "return_requested";
  if (!isBorrowed) return false;
  return new Date(loan.dueDate).getTime() < referenceTimestamp;
}

/**
 * Validates initial loan request rules.
 */
export function validateNewLoanRequest(
  item: Item,
  borrowerUserId: string,
  existingLoansOnItem: Loan[],
): void {
  // Rule: Users cannot borrow their own items
  if (item.ownerId === borrowerUserId) {
    throw new BusinessRuleError("You cannot borrow your own item");
  }

  // Rule: Item must be available
  if (item.status !== "available") {
    throw new ConflictError(`Item is not available for borrowing (status: '${item.status}')`);
  }

  // Rule: Check for active or pending conflicting loans on this item
  const hasConflictingLoan = existingLoansOnItem.some(
    (l) =>
      l.status === "pending" ||
      l.status === "approved" ||
      l.status === "borrowed" ||
      l.status === "active" ||
      l.status === "return_requested",
  );
  if (hasConflictingLoan) {
    throw new ConflictError("This item already has an active or pending loan request");
  }
}

/**
 * Asserts that caller is either borrower or lender to view loan details.
 */
export function assertCanAccessLoan(loan: Loan, callerUserId: string): void {
  if (loan.borrowerId !== callerUserId && loan.lenderId !== callerUserId) {
    throw new ForbiddenError("You do not have permission to view this loan");
  }
}
