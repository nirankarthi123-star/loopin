/**
 * TrustScore Domain Logic & Calculation Engine — LoopIn Backend
 *
 * FEATURES:
 * - 0–100 bounded scale.
 * - New verified users start at provisional 70.
 * - Calculations performed strictly server-side from verified loan events.
 * - No penalty for having zero borrowing history.
 * - Distinguishes provisional scores (< 3 completed transactions) from mature scores.
 * - Generates human-friendly explanations without leaking private borrowing details.
 */

import type { Loan, ReliabilityScoreBreakdown, UserProfile } from "@loopin/shared";

export const PROVISIONAL_BASE_SCORE = 70;
export const MIN_HISTORY_FOR_MATURE_SCORE = 3;

/**
 * Computes detailed TrustScore breakdown and explanation from verified ledger loans.
 */
export function calculateDetailedReliabilityScore(
  borrowerLoans: Loan[],
  lenderLoans: Loan[] = [],
): ReliabilityScoreBreakdown {
  let onTimeReturns = 0;
  let lateReturns = 0;
  let cancellations = 0;
  const itemsLent = lenderLoans.filter(
    (l) => l.status === "completed" || l.status === "returned",
  ).length;

  // Count borrower loan events
  for (const loan of borrowerLoans) {
    if (loan.status === "completed" || loan.status === "returned") {
      const returnTime = loan.returnedAt ? new Date(loan.returnedAt).getTime() : Date.now();
      const dueTime = new Date(loan.dueDate).getTime();
      if (returnTime <= dueTime) {
        onTimeReturns += 1;
      } else {
        lateReturns += 1;
      }
    } else if (loan.status === "cancelled") {
      cancellations += 1;
    }
  }

  // Active overdue check: If currently borrowed and past dueDate, count as late penalty
  const now = Date.now();
  const activeOverdueLoans = borrowerLoans.filter((l) => {
    const isBorrowed = l.status === "borrowed" || l.status === "active" || l.status === "return_requested";
    return isBorrowed && new Date(l.dueDate).getTime() < now;
  });
  const activeOverdueCount = activeOverdueLoans.length;

  const verifiedLoanEvents = onTimeReturns + lateReturns + activeOverdueCount + itemsLent;
  const isProvisional = verifiedLoanEvents < MIN_HISTORY_FOR_MATURE_SCORE;

  // Baseline provisional starts at 70
  let rawScore = PROVISIONAL_BASE_SCORE;

  // Positive increments
  rawScore += onTimeReturns * 3;
  rawScore += itemsLent * 2;

  // Penalties
  rawScore -= lateReturns * 7;
  rawScore -= activeOverdueCount * 12;
  rawScore -= cancellations * 2;

  // Bounded strictly between 0 and 100
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const confidenceLevel: "provisional" | "developing" | "established" =
    verifiedLoanEvents < 3
      ? "provisional"
      : verifiedLoanEvents < 8
      ? "developing"
      : "established";

  const tier =
    score >= 90
      ? "platinum"
      : score >= 70
      ? "gold"
      : score >= 40
      ? "silver"
      : score > 0
      ? "bronze"
      : "new";

  // Generate explainable summary without exposing specific item titles or loan partners
  let explanation = "";
  if (isProvisional) {
    explanation =
      "Provisional campus score of 70 assigned to new members. Scores increase as you complete on-time returns and share items.";
    if (onTimeReturns > 0 || itemsLent > 0) {
      explanation += ` You have completed ${verifiedLoanEvents} verified activity event(s).`;
    }
  } else {
    explanation = `Score backed by ${verifiedLoanEvents} verified campus transactions (${onTimeReturns} on-time returns, ${itemsLent} items shared).`;
    if (lateReturns > 0 || activeOverdueCount > 0) {
      explanation += ` Includes impact from ${lateReturns + activeOverdueCount} overdue/late return(s).`;
    }
  }

  return {
    score,
    isProvisional,
    confidenceLevel,
    verifiedLoanEvents,
    onTimeReturns,
    lateReturns: lateReturns + activeOverdueCount,
    cancellations,
    itemsLent,
    explanation,
    tier,
  };
}

/**
 * Derives user profile stats strictly from ledger records.
 */
export function deriveUserStats(
  baseProfile: UserProfile,
  allUserLoans: Loan[],
): UserProfile {
  const borrowerLoans = allUserLoans.filter((l) => l.borrowerId === baseProfile.userId);
  const lenderLoans = allUserLoans.filter((l) => l.lenderId === baseProfile.userId);

  const borrowCount = borrowerLoans.filter(
    (l) =>
      l.status === "borrowed" ||
      l.status === "active" ||
      l.status === "return_requested" ||
      l.status === "completed" ||
      l.status === "returned",
  ).length;

  const lendCount = lenderLoans.filter(
    (l) =>
      l.status === "borrowed" ||
      l.status === "active" ||
      l.status === "return_requested" ||
      l.status === "completed" ||
      l.status === "returned",
  ).length;

  // Savings: count completed or active loans where borrower avoided buying
  const totalSavings = borrowerLoans
    .filter(
      (l) =>
        (l.status === "completed" || l.status === "returned" || l.status === "borrowed" || l.status === "active") &&
        l.wouldHavePurchased !== false,
    )
    .reduce((sum, l) => sum + (l.savingsValue || 0), 0);

  const { score } = calculateDetailedReliabilityScore(borrowerLoans, lenderLoans);

  return {
    ...baseProfile,
    borrowCount,
    lendCount,
    totalSavings,
    reliabilityScore: score,
    updatedAt: new Date().toISOString(),
  };
}

export function calculateReliabilityScore(loans: Loan[]): number {
  return calculateDetailedReliabilityScore(loans).score;
}
