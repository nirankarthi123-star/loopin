// ─────────────────────────────────────────────────────────────────────────────
// Shared Types — LoopIn
// These types are consumed by both frontend (React) and backend (Lambda).
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ─────────────────────────────────────────────────────────────────────

export type ItemCategory =
  | "electronics"
  | "books"
  | "sports"
  | "tools"
  | "stationery"
  | "kitchen"
  | "clothing"
  | "musical_instruments"
  | "other";

export type ItemStatus = "available" | "on_loan" | "unavailable";

export type ItemCondition = "new" | "like_new" | "good" | "fair";

export type LoanStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "borrowed"
  | "return_requested"
  | "completed"
  | "cancelled"
  // Backwards compatibility aliases
  | "active"
  | "returned"
  | "overdue";

export type NotificationType =
  | "loan_requested"
  | "loan_approved"
  | "loan_rejected"
  | "due_tomorrow"
  | "return_reminder"
  | "overdue"
  | "item_returned"
  | "score_updated";

// ── Core Entities ─────────────────────────────────────────────────────────────

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  campusId: string;
  avatarUrl?: string;
  bio?: string;
  emailVerified?: boolean;
  campusVerified?: boolean;
  reliabilityScore: number; // 0-100
  totalSavings: number; // INR (₹) estimated savings
  borrowCount: number;
  lendCount: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface Item {
  itemId: string;
  ownerId: string;
  ownerName: string; // Denormalized for display
  title: string;
  description: string;
  category: ItemCategory;
  estimatedValue: number; // INR (₹) replacement value
  imageUrl?: string;
  status: ItemStatus;
  condition: ItemCondition;
  tags: string[];
  campusId: string;
  pickupLocation?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReminderType = "upcoming_due" | "overdue";

export interface LoanReminderRecord {
  scheduleName?: string | undefined;
  scheduledFor: string; // ISO 8601
  sentAt?: string | undefined; // ISO 8601 when successfully processed
  status: "scheduled" | "sent" | "skipped" | "failed";
  skipReason?: string | undefined;
  messageId?: string | undefined;
}

export interface Loan {
  loanId: string;
  itemId: string;
  itemTitle: string; // Denormalized
  borrowerId: string;
  borrowerName: string; // Denormalized
  borrowerEmail?: string | undefined; // For notifications
  lenderId: string;
  lenderName: string; // Denormalized
  lenderEmail?: string | undefined; // For notifications
  status: LoanStatus;
  requestedAt: string;
  approvedAt?: string | undefined;
  borrowedAt?: string | undefined;
  returnRequestedAt?: string | undefined;
  returnedAt?: string | undefined;
  dueDate: string;
  durationDays?: number | undefined; // Number of days borrowed
  rentalFee?: number | undefined; // INR rental fee (capped < 15% of cost price)
  borrowerNote?: string | undefined;
  lenderNote?: string | undefined;
  savingsValue: number; // INR (₹) estimated savings from avoiding purchase
  wouldHavePurchased?: boolean | undefined; // Impact tracker survey field
  // Automated return reminders tracking
  reminderSchedules?: {
    upcomingScheduleName?: string | undefined;
    overdueScheduleName?: string | undefined;
  } | undefined;
  notificationHistory?: {
    upcoming_due?: LoanReminderRecord | undefined;
    overdue?: LoanReminderRecord | undefined;
  } | undefined;
}

export interface Notification {
  notificationId: string;
  userId: string;
  type: NotificationType;
  loanId?: string;
  itemId?: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// ── API Request / Response Types ──────────────────────────────────────────────

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    cursor?: string;
    count?: number;
    total?: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: Record<string, unknown>;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ── Pagination ─────────────────────────────────────────────────────────────────

export interface PaginatedList<T> {
  items: T[];
  cursor?: string; // Next page cursor
  count: number;
}

// ── Request Bodies ─────────────────────────────────────────────────────────────

export interface CreateItemRequest {
  title: string;
  description: string;
  category: ItemCategory;
  estimatedValue: number;
  imageUrl?: string;
  condition: ItemCondition;
  tags: string[];
}

export interface UpdateItemRequest {
  title?: string;
  description?: string;
  category?: ItemCategory;
  estimatedValue?: number;
  imageUrl?: string;
  condition?: ItemCondition;
  tags?: string[];
  status?: ItemStatus;
}

export interface CreateLoanRequest {
  itemId: string;
  dueDate: string; // ISO 8601
  durationDays?: number;
  rentalFee?: number;
  borrowerNote?: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

// ── Query Params ───────────────────────────────────────────────────────────────

export interface ListItemsQuery {
  campusId?: string;
  category?: ItemCategory;
  status?: ItemStatus;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface ListLoansQuery {
  role?: "borrower" | "lender";
  status?: LoanStatus;
  cursor?: string;
  limit?: number;
}

// ── Score Breakdown & Explanation ─────────────────────────────────────────────

export interface ReliabilityScoreBreakdown {
  score: number; // 0-100
  isProvisional: boolean; // true if new member with < 3 verified loans
  confidenceLevel: "provisional" | "developing" | "established";
  verifiedLoanEvents: number;
  onTimeReturns: number; // count
  lateReturns: number;
  cancellations: number;
  itemsLent: number;
  explanation: string;
  tier: "new" | "bronze" | "silver" | "gold" | "platinum";
}

// ── Smart Need Matcher ────────────────────────────────────────────────────────

export interface SmartNeedQuery {
  naturalQuery?: string;
  itemOrCategory?: string;
  requiredDate?: string; // ISO 8601
  pickupLocation?: string;
}

export interface MatchReason {
  field: "title" | "category" | "tags" | "location" | "availability";
  label: string;
  scoreContribution: number;
}

export interface SmartMatchResult {
  item: Item;
  matchScore: number; // 0-100
  isExactMatch: boolean;
  matchReasons: MatchReason[];
}

export interface SavedNeedRequest {
  requestId: string;
  userId: string;
  queryText: string;
  category?: ItemCategory;
  requiredDate?: string;
  preferredLocation?: string;
  campusId: string;
  createdAt: string;
}

// ── Impact Tracker ────────────────────────────────────────────────────────────

export interface CampusImpactSummary {
  campusId: string;
  campusName: string;
  completedLoansCount: number;
  uniqueReusedItemsCount: number;
  estimatedPurchasesAvoidedCount: number;
  estimatedMoneySavedINR: number; // INR (₹) total estimated savings
  estimatedMoneySavedUSD?: number; // Legacy alias pointing to estimated money saved
  membersCount: number;
  methodologyNote: string;
}

// ── Campus ────────────────────────────────────────────────────────────────────

export interface Campus {
  campusId: string;
  name: string;
  university: string;
  country: string;
}
