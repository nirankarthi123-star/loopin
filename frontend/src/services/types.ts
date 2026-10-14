/**
 * Service layer types — LoopIn
 *
 * These extend the shared API types with UI-specific state
 * and operation contracts. The service layer sits between
 * components and the data source (mock or AWS).
 */

import type {
  Item,
  Loan,
  UserProfile,
  CreateItemRequest,
  UpdateItemRequest,
  CreateLoanRequest,
  LoanStatus,
  Notification,
} from "@loopin/shared";

/** Generic async result type used by all service operations. */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Community stats returned by the stats service. */
export interface CommunityStats {
  totalItems: number;
  activeLoans: number;
  totalSavings: number;
  campusName: string;
  membersCount: number;
  completedLoans: number;
}

/** Filters for listing items. */
export interface ItemFilters {
  search?: string | undefined;
  category?: string | undefined;
  condition?: string | undefined;
  status?: string | undefined;
  sortBy?: ("newest" | "oldest" | "value_desc" | "value_asc") | undefined;
}

/** Filters for listing loans. */
export interface LoanFilters {
  role?: "borrower" | "lender";
  status?: LoanStatus;
}

/** Full item detail view including owner profile. */
export interface ItemDetail extends Item {
  owner: Pick<UserProfile, "displayName" | "reliabilityScore" | "campusId">;
}

// Re-export shared types for convenience within the service layer
export type {
  Item,
  Loan,
  UserProfile,
  CreateItemRequest,
  UpdateItemRequest,
  CreateLoanRequest,
  Notification,
};
