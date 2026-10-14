import { describe, it, expect, beforeEach } from "vitest";
import type { Loan, Item } from "@loopin/shared";
import {
  calculateDetailedReliabilityScore,
  PROVISIONAL_BASE_SCORE,
  deriveUserStats,
} from "@loopin/backend/domain/trustScore.js";
import {
  validateLoanTransition,
  validateNewLoanRequest,
  isLoanOverdue,
} from "@loopin/backend/domain/loanLifecycle.js";
import { matchItemsForNeed, parseNaturalNeedQuery } from "@loopin/backend/domain/smartMatcher.js";
import { calculateCampusImpact } from "@loopin/backend/domain/impactTracker.js";
import { ConflictError, ForbiddenError, BusinessRuleError } from "@loopin/backend/domain/errors.js";

describe("LoopIn Signature Innovations — Comprehensive Domain & Persistence Suite", () => {
  const baseItem: Item = {
    itemId: "item-calc-001",
    ownerId: "lender-user-id",
    ownerName: "Lender User",
    title: "Casio FX-991EX Scientific Calculator",
    description: "Engineering calculator near the electrical engineering block.",
    category: "electronics",
    estimatedValue: 45,
    status: "available",
    condition: "like_new",
    tags: ["calculator", "exam", "engineering"],
    campusId: "campus-vit-chennai",
    pickupLocation: "Engineering Block C",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const createLoan = (overrides: Partial<Loan> = {}): Loan => ({
    loanId: `loan-${Math.random().toString(36).substring(2, 9)}`,
    itemId: "item-calc-001",
    itemTitle: "Casio FX-991EX Scientific Calculator",
    borrowerId: "borrower-user-id",
    borrowerName: "Borrower User",
    lenderId: "lender-user-id",
    lenderName: "Lender User",
    status: "completed",
    requestedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    dueDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    returnedAt: new Date(Date.now() - 4 * 86400000).toISOString(), // on-time
    savingsValue: 45,
    wouldHavePurchased: true,
    ...overrides,
  });

  // ── FEATURE 1: TRUSTSCORE ───────────────────────────────────────────────────
  describe("Feature 1: TrustScore Engine", () => {
    it("should assign a new student with no history a provisional score of 70", () => {
      const breakdown = calculateDetailedReliabilityScore([]);
      expect(breakdown.score).toBe(PROVISIONAL_BASE_SCORE);
      expect(breakdown.isProvisional).toBe(true);
      expect(breakdown.confidenceLevel).toBe("provisional");
      expect(breakdown.verifiedLoanEvents).toBe(0);
      expect(breakdown.explanation).toContain("Provisional campus score of 70");
    });

    it("should not penalize students simply for having no borrowing history", () => {
      const breakdown = calculateDetailedReliabilityScore([]);
      expect(breakdown.score).toBe(70);
      expect(breakdown.lateReturns).toBe(0);
      expect(breakdown.cancellations).toBe(0);
    });

    it("should distinguish provisional scores (<3 events) from mature scores (>=3 events)", () => {
      // 2 on-time returns -> still provisional
      const provisionalBreakdown = calculateDetailedReliabilityScore([
        createLoan(),
        createLoan(),
      ]);
      expect(provisionalBreakdown.isProvisional).toBe(true);
      expect(provisionalBreakdown.confidenceLevel).toBe("provisional");

      // 3 on-time returns -> mature score
      const matureBreakdown = calculateDetailedReliabilityScore([
        createLoan(),
        createLoan(),
        createLoan(),
      ]);
      expect(matureBreakdown.isProvisional).toBe(false);
      expect(matureBreakdown.confidenceLevel).toBe("developing");
      expect(matureBreakdown.score).toBeGreaterThan(70); // 70 + 3*3 = 79
    });

    it("should penalize overdue and late returns server-side without leaking private titles", () => {
      const lateLoan = createLoan({
        dueDate: new Date(Date.now() - 5 * 86400000).toISOString(),
        returnedAt: new Date(Date.now() - 2 * 86400000).toISOString(), // 3 days late
      });

      const breakdown = calculateDetailedReliabilityScore([lateLoan]);
      expect(breakdown.lateReturns).toBe(1);
      expect(breakdown.score).toBeLessThan(70);
      // Explanation explains score without revealing specific item title or partner name
      expect(breakdown.explanation).not.toContain("Casio FX-991EX");
      expect(breakdown.explanation).not.toContain("Lender User");
    });

    it("should penalize active loans that are past due date", () => {
      const activeOverdueLoan = createLoan({
        status: "borrowed",
        dueDate: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days in the past
        returnedAt: undefined,
      });

      expect(isLoanOverdue(activeOverdueLoan)).toBe(true);
      const breakdown = calculateDetailedReliabilityScore([activeOverdueLoan]);
      expect(breakdown.lateReturns).toBe(1);
      expect(breakdown.score).toBeLessThan(70);
    });
  });

  // ── FEATURE 2: SMART NEED MATCHER ───────────────────────────────────────────
  describe("Feature 2: Smart Need Matcher", () => {
    it("should parse natural language queries deterministically", () => {
      const query = "I need a calculator tomorrow near the engineering block";
      const parsed = parseNaturalNeedQuery(query);

      expect(parsed.extractedCategory).toBe("electronics");
      expect(parsed.tokens).toContain("calculator");
      expect(parsed.locationHint).toContain("engineering");
    });

    it("should rank items by relevance and explain match reasons", () => {
      const items: Item[] = [
        baseItem,
        {
          ...baseItem,
          itemId: "item-drill-002",
          title: "Cordless Rotary Hammer Drill",
          description: "Heavy duty masonry drill.",
          category: "tools",
          pickupLocation: "Hostel 4",
        },
      ];

      const matches = matchItemsForNeed(items, {
        naturalQuery: "I need a calculator near the engineering block",
      });

      expect(matches.length).toBeGreaterThan(0);
      const topMatch = matches[0];
      expect(topMatch).toBeDefined();
      expect(topMatch!.item.itemId).toBe("item-calc-001");
      expect(topMatch!.matchScore).toBeGreaterThanOrEqual(70);
      expect(topMatch!.isExactMatch).toBe(true);

      const fields = topMatch!.matchReasons.map((r) => r.field);
      expect(fields).toContain("title");
      expect(fields).toContain("location");
    });

    it("should suggest related category listings if no exact match exists", () => {
      const items: Item[] = [
        {
          ...baseItem,
          itemId: "item-multimeter",
          title: "Digital Multimeter Fluke",
          description: "EE lab multimeter.",
          category: "electronics",
        },
      ];

      const matches = matchItemsForNeed(items, {
        naturalQuery: "oscilloscope for electronics lab",
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.matchReasons.some((r) => r.field === "category")).toBe(true);
    });
  });

  // ── FEATURE 3: BORROW INSTEAD OF BUY IMPACT TRACKER ─────────────────────────
  describe("Feature 3: Borrow Instead of Buy Impact Tracker", () => {
    it("should keep pending, rejected, and cancelled loans out of completed-loan metrics", () => {
      const loans: Loan[] = [
        createLoan({ status: "completed" }),
        createLoan({ status: "pending" }),
        createLoan({ status: "rejected" }),
        createLoan({ status: "cancelled" }),
        createLoan({ status: "borrowed" }),
      ];

      const impact = calculateCampusImpact(loans, 50);
      expect(impact.completedLoansCount).toBe(1);
    });

    it("should prevent double-counting duplicate loan records", () => {
      const loan = createLoan({ loanId: "fixed-loan-1", status: "completed" });
      const duplicateList = [loan, loan, { ...loan }];

      const impact = calculateCampusImpact(duplicateList, 50);
      expect(impact.completedLoansCount).toBe(1);
      expect(impact.estimatedPurchasesAvoidedCount).toBe(1);
    });

    it("should track avoided purchases only when borrower indicates they would otherwise have bought", () => {
      const loans: Loan[] = [
        createLoan({ status: "completed", wouldHavePurchased: true, savingsValue: 50 }),
        createLoan({ status: "completed", wouldHavePurchased: false, savingsValue: 100 }), // wouldn't have bought
      ];

      const impact = calculateCampusImpact(loans, 50);
      expect(impact.completedLoansCount).toBe(2);
      expect(impact.estimatedPurchasesAvoidedCount).toBe(1);
      expect(impact.estimatedMoneySavedUSD).toBe(50);
    });

    it("should correctly compute unique reused items across repeat loans", () => {
      const loans: Loan[] = [
        createLoan({ loanId: "l1", itemId: "item-drill", status: "completed" }),
        createLoan({ loanId: "l2", itemId: "item-drill", status: "completed" }), // repeat loan on same item
        createLoan({ loanId: "l3", itemId: "item-camera", status: "completed" }),
      ];

      const impact = calculateCampusImpact(loans, 20);
      expect(impact.completedLoansCount).toBe(3);
      expect(impact.uniqueReusedItemsCount).toBe(2); // drill + camera
    });
  });

  // ── FEATURE 4: LOAN STATE MACHINE & WORKFLOW ────────────────────────────────
  describe("Feature 4: Loan Workflow State Machine", () => {
    const loan: Loan = {
      loanId: "test-loan-state",
      itemId: "item-calc-001",
      itemTitle: "Calculator",
      borrowerId: "borrower-1",
      borrowerName: "Borrower",
      lenderId: "lender-1",
      lenderName: "Lender",
      status: "pending",
      requestedAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      savingsValue: 45,
    };

    it("should follow explicit workflow: pending -> approved -> borrowed -> return_requested -> completed", () => {
      // 1. Approve (Lender)
      const approved = validateLoanTransition(loan, "approve", "lender-1");
      expect(approved.nextStatus).toBe("approved");

      // 2. Pickup (Borrower)
      const loanApproved: Loan = { ...loan, status: "approved" };
      const borrowed = validateLoanTransition(loanApproved, "pickup", "borrower-1");
      expect(borrowed.nextStatus).toBe("borrowed");

      // 3. Request Return (Borrower)
      const loanBorrowed: Loan = { ...loan, status: "borrowed" };
      const retReq = validateLoanTransition(loanBorrowed, "request_return", "borrower-1");
      expect(retReq.nextStatus).toBe("return_requested");

      // 4. Confirm Return (Lender)
      const loanRetReq: Loan = { ...loan, status: "return_requested" };
      const completed = validateLoanTransition(loanRetReq, "confirm_return", "lender-1");
      expect(completed.nextStatus).toBe("completed");
    });

    it("should allow borrower to cancel a pending loan request", () => {
      const cancelled = validateLoanTransition(loan, "cancel", "borrower-1");
      expect(cancelled.nextStatus).toBe("cancelled");
    });

    it("should prevent lender or unauthorized third party from cancelling a loan", () => {
      expect(() => validateLoanTransition(loan, "cancel", "lender-1")).toThrowError(ForbiddenError);
      expect(() => validateLoanTransition(loan, "cancel", "stranger-9")).toThrowError(ForbiddenError);
    });

    it("should reject invalid state transitions", () => {
      // Cannot jump from pending directly to completed
      expect(() => validateLoanTransition(loan, "confirm_return", "lender-1")).toThrowError(ConflictError);
      // Cannot pickup a pending loan before approval
      expect(() => validateLoanTransition(loan, "pickup", "borrower-1")).toThrowError(ConflictError);
    });
  });
});
