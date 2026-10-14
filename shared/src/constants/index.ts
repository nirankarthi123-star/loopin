// ─────────────────────────────────────────────────────────────────────────────
// Shared Constants — LoopIn
// ─────────────────────────────────────────────────────────────────────────────

import type { ItemCategory, ItemCondition, ItemStatus, LoanStatus } from "../types/index.js";

// ── Reliability Score Thresholds ──────────────────────────────────────────────

export const SCORE_TIERS = {
  new: { min: 0, max: 0, label: "New Member" },
  bronze: { min: 1, max: 39, label: "Bronze" },
  silver: { min: 40, max: 69, label: "Silver" },
  gold: { min: 70, max: 89, label: "Gold" },
  platinum: { min: 90, max: 100, label: "Platinum" },
} as const;

// ── Loan Defaults ─────────────────────────────────────────────────────────────

export const DEFAULT_LOAN_DURATION_DAYS = 7;
export const MAX_LOAN_DURATION_DAYS = 30;
export const OVERDUE_GRACE_PERIOD_HOURS = 24;

// ── Rental Pricing Rules ──────────────────────────────────────────────────────
// Policy: Rent must stay strictly lesser than 15% of the item's cost price,
// scaled proportionally with the duration (number of days) it has been borrowed.
export const MAX_RENT_PERCENT_OF_COST = 0.15; // 15% cap

/**
 * Calculates the fair campus rental fee based on item cost price (estimatedValue) and loan duration in days.
 * - Guaranteed strictly LESS THAN 15% of the cost price: capped at Math.min(..., costPrice * 0.149).
 * - Scales proportionally with duration: base rate is ~0.5% of cost price per day.
 * - If days <= 0 or costPrice <= 0, returns 0.
 */
export function calculateRentalFee(costPrice: number, days: number): number {
  if (costPrice <= 0 || days <= 0) return 0;
  const safeDays = Math.max(1, Math.min(days, MAX_LOAN_DURATION_DAYS));
  // 0.5% per day, capped strictly below 15% (at 14% max for 30 days)
  const ratePerDay = 0.005; // 0.5% of cost price per day
  const rawFee = costPrice * ratePerDay * safeDays;
  const strictCap = costPrice * 0.14; // Strictly less than 15% of cost price (max 14%)
  return Math.max(1, Math.round(Math.min(rawFee, strictCap)));
}

// ── Pagination ─────────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ── Item Categories ───────────────────────────────────────────────────────────

export const ITEM_CATEGORIES: Record<ItemCategory, string> = {
  electronics: "Electronics",
  books: "Books & Stationery",
  sports: "Sports & Outdoors",
  tools: "Tools & Equipment",
  stationery: "Stationery",
  kitchen: "Kitchen & Dining",
  clothing: "Clothing & Accessories",
  musical_instruments: "Musical Instruments",
  other: "Other",
};

export const ITEM_CONDITIONS: Record<ItemCondition, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
};

export const ITEM_STATUSES: Record<ItemStatus, string> = {
  available: "Available",
  on_loan: "On Loan",
  unavailable: "Unavailable",
};

export const LOAN_STATUSES: Record<LoanStatus, string> = {
  pending: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  borrowed: "Borrowed (In Use)",
  return_requested: "Return Requested",
  completed: "Completed & Returned",
  cancelled: "Cancelled",
  // Legacy aliases
  active: "Active",
  returned: "Returned",
  overdue: "Overdue",
};

// ── Documented Category Reference Prices (INR ₹) ─────────────────────────────
// Used by Borrow Instead of Buy Impact Tracker when item estimatedValue is missing or as a benchmark
// Values are approximate Indian retail prices in Rupees.
export const CATEGORY_REFERENCE_PRICES: Record<ItemCategory, number> = {
  electronics: 7200,    // ~₹7,200 (e.g. calculator, peripherals)
  books:        3800,   // ~₹3,800 (textbooks)
  sports:       4200,   // ~₹4,200 (rackets, gear)
  tools:        5000,   // ~₹5,000 (multimeter, drill etc.)
  stationery:   1200,   // ~₹1,200 (drawing instruments, sets)
  kitchen:      3000,   // ~₹3,000 (appliances)
  clothing:     3400,   // ~₹3,400 (jackets, formal wear)
  musical_instruments: 10000, // ~₹10,000 (guitar, keyboard)
  other:        2500,   // ~₹2,500 (general)
};

// ── API Error Codes ───────────────────────────────────────────────────────────

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  ITEM_NOT_FOUND: "ITEM_NOT_FOUND",
  LOAN_NOT_FOUND: "LOAN_NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  ITEM_UNAVAILABLE: "ITEM_UNAVAILABLE",
  INVALID_LOAN_TRANSITION: "INVALID_LOAN_TRANSITION",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CANNOT_BORROW_OWN_ITEM: "CANNOT_BORROW_OWN_ITEM",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ── DynamoDB Key Prefixes ─────────────────────────────────────────────────────

export const DDB_PREFIXES = {
  USER: "USER#",
  ITEM: "ITEM#",
  LOAN: "LOAN#",
  NOTIF: "NOTIF#",
  CAMPUS: "CAMPUS#",
  PROFILE: "PROFILE",
  METADATA: "METADATA",
} as const;

// ── Campuses (seed data) ──────────────────────────────────────────────────────

export const DEMO_CAMPUSES = [
  { campusId: "campus-vit-chennai", name: "VIT Chennai", university: "Vellore Institute of Technology, Chennai", country: "India" },
  { campusId: "campus-iit-madras", name: "IIT Madras", university: "IIT Madras", country: "India" },
  { campusId: "campus-iit-delhi", name: "IIT Delhi", university: "IIT Delhi", country: "India" },
  { campusId: "campus-mit", name: "MIT", university: "Massachusetts Institute of Technology", country: "USA" },
] as const;

export const DEFAULT_CAMPUS_ID = "campus-vit-chennai";
