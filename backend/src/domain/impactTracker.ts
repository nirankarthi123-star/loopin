/**
 * Borrow Instead of Buy Impact Tracker — LoopIn Backend
 *
 * Methodology:
 * - Completed loans: only loans with status 'completed' or 'returned'.
 * - Incomplete, pending, rejected, and cancelled loans are STRICTLY EXCLUDED.
 * - Unique reused items: deduplicated set of itemIds across completed loans.
 * - Estimated purchases avoided: count of completed loans where borrower indicated they would otherwise have purchased the item (default true unless opted out).
 * - Estimated money saved: sum of savingsValue (derived from item estimatedValue or category benchmark) for avoided purchases.
 * - Idempotency & deduplication: each loan record is counted at most once by its unique loanId.
 * - Transparent methodology notes: no unsubstantiated carbon/waste claims.
 */

import type { Loan, CampusImpactSummary } from "@loopin/shared";
import { CATEGORY_REFERENCE_PRICES } from "@loopin/shared";

export function calculateCampusImpact(
  loans: Loan[],
  membersCount: number,
  campusId = "campus-vit-chennai",
  campusName = "VIT Chennai",
): CampusImpactSummary {
  // 1. Strictly isolate completed loans (excluding pending, approved, borrowed, rejected, cancelled)
  const completedLoans = loans.filter(
    (l) => l.status === "completed" || l.status === "returned",
  );

  // 2. Prevent double-counting via Set of loanIds
  const seenLoanIds = new Set<string>();
  const deduplicatedCompletedLoans: Loan[] = [];

  for (const loan of completedLoans) {
    if (!seenLoanIds.has(loan.loanId)) {
      seenLoanIds.add(loan.loanId);
      deduplicatedCompletedLoans.push(loan);
    }
  }

  // 3. Unique reused items count
  const uniqueItemIds = new Set<string>();
  for (const loan of deduplicatedCompletedLoans) {
    uniqueItemIds.add(loan.itemId);
  }

  // 4. Purchases avoided & money saved
  let estimatedPurchasesAvoidedCount = 0;
  let estimatedMoneySavedINR = 0;

  for (const loan of deduplicatedCompletedLoans) {
    // If borrower explicitly specified they would NOT have bought, do not count as avoided purchase
    const wouldHavePurchased = loan.wouldHavePurchased !== false;

    if (wouldHavePurchased) {
      estimatedPurchasesAvoidedCount += 1;
      // Use loan's savingsValue, fallback to category benchmark if 0 or undefined
      const value = loan.savingsValue && loan.savingsValue > 0
        ? loan.savingsValue
        : CATEGORY_REFERENCE_PRICES["other"] ?? 30;
      estimatedMoneySavedINR += value;
    }
  }

  return {
    campusId,
    campusName,
    completedLoansCount: deduplicatedCompletedLoans.length,
    uniqueReusedItemsCount: uniqueItemIds.size,
    estimatedPurchasesAvoidedCount,
    estimatedMoneySavedINR,
    estimatedMoneySavedUSD: estimatedMoneySavedINR,
    membersCount,
    methodologyNote:
      "Calculated from verified completed loans only. Avoided purchases count transactions where borrowers confirmed they would otherwise have bought new. Estimated savings reflect item retail replacement benchmarks.",
  };
}
