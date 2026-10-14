import { describe, it, expect } from "vitest";
import {
  validateLoanTransition,
  validateNewLoanRequest,
  assertCanAccessLoan,
} from "@loopin/backend/domain/loanLifecycle.js";
import {
  ForbiddenError,
  ConflictError,
  BusinessRuleError,
} from "@loopin/backend/domain/errors.js";
import type { Item, Loan } from "@loopin/shared";

describe("Loan Lifecycle & Permissions Domain Logic", () => {
  const mockItem: Item = {
    itemId: "item-001",
    ownerId: "lender-user-id",
    ownerName: "Lender Name",
    title: "Canon EOS Camera",
    description: "DSLR camera in pristine condition.",
    category: "electronics",
    estimatedValue: 500,
    status: "available",
    condition: "like_new",
    tags: ["camera"],
    campusId: "campus-vit-chennai",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockLoan: Loan = {
    loanId: "loan-001",
    itemId: "item-001",
    itemTitle: "Canon EOS Camera",
    borrowerId: "borrower-user-id",
    borrowerName: "Borrower Name",
    lenderId: "lender-user-id",
    lenderName: "Lender Name",
    status: "pending",
    requestedAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    savingsValue: 500,
  };

  describe("Borrow Request Rules", () => {
    it("should prevent a user from borrowing their own item", () => {
      expect(() => {
        validateNewLoanRequest(mockItem, "lender-user-id", []);
      }).toThrowError(BusinessRuleError);
    });

    it("should prevent borrowing an item that is not available", () => {
      const unavailableItem = { ...mockItem, status: "on_loan" as const };
      expect(() => {
        validateNewLoanRequest(unavailableItem, "borrower-user-id", []);
      }).toThrowError(ConflictError);
    });

    it("should prevent duplicate concurrent active/pending loan requests on the same item", () => {
      const existingPendingLoan = { ...mockLoan, status: "pending" as const };
      expect(() => {
        validateNewLoanRequest(mockItem, "borrower-user-id", [existingPendingLoan]);
      }).toThrowError(ConflictError);
    });

    it("should allow loan request when item is available and borrower is distinct", () => {
      expect(() => {
        validateNewLoanRequest(mockItem, "borrower-user-id", []);
      }).not.toThrow();
    });
  });

  describe("State Transitions & Role Permissions", () => {
    it("should allow only the lender to approve a pending loan", () => {
      // Lender approves -> succeeds
      const result = validateLoanTransition(mockLoan, "approve", "lender-user-id");
      expect(result.nextStatus).toBe("approved");

      // Borrower attempts approve -> ForbiddenError
      expect(() => {
        validateLoanTransition(mockLoan, "approve", "borrower-user-id");
      }).toThrowError(ForbiddenError);

      // Third party attempts approve -> ForbiddenError
      expect(() => {
        validateLoanTransition(mockLoan, "approve", "random-hacker-id");
      }).toThrowError(ForbiddenError);
    });

    it("should allow only the lender to reject a pending loan", () => {
      const result = validateLoanTransition(mockLoan, "reject", "lender-user-id");
      expect(result.nextStatus).toBe("rejected");

      expect(() => {
        validateLoanTransition(mockLoan, "reject", "borrower-user-id");
      }).toThrowError(ForbiddenError);
    });

    it("should allow borrower or lender to mark pickup once approved", () => {
      const approvedLoan: Loan = { ...mockLoan, status: "approved" };

      // Borrower pickup -> borrowed
      const bRes = validateLoanTransition(approvedLoan, "pickup", "borrower-user-id");
      expect(bRes.nextStatus).toBe("borrowed");

      // Lender pickup -> borrowed
      const lRes = validateLoanTransition(approvedLoan, "pickup", "lender-user-id");
      expect(lRes.nextStatus).toBe("borrowed");

      // Third party -> ForbiddenError
      expect(() => {
        validateLoanTransition(approvedLoan, "pickup", "third-party-user");
      }).toThrowError(ForbiddenError);
    });

    it("should allow only the lender to mark item returned/completed", () => {
      const activeLoan: Loan = { ...mockLoan, status: "borrowed" };

      const result = validateLoanTransition(activeLoan, "return", "lender-user-id");
      expect(result.nextStatus).toBe("completed");

      // Borrower cannot unilaterally confirm return
      expect(() => {
        validateLoanTransition(activeLoan, "return", "borrower-user-id");
      }).toThrowError(ForbiddenError);
    });

    it("should reject invalid state transitions (e.g., returning a pending loan)", () => {
      expect(() => {
        validateLoanTransition(mockLoan, "return", "lender-user-id");
      }).toThrowError(ConflictError);
    });
  });

  describe("Access Control", () => {
    it("should allow borrower and lender to access loan details", () => {
      expect(() => assertCanAccessLoan(mockLoan, "borrower-user-id")).not.toThrow();
      expect(() => assertCanAccessLoan(mockLoan, "lender-user-id")).not.toThrow();
    });

    it("should deny unauthorized third parties from viewing loan details", () => {
      expect(() => assertCanAccessLoan(mockLoan, "stranger-id")).toThrowError(ForbiddenError);
    });
  });
});
