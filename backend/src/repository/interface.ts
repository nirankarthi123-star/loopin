/**
 * Repository Interface — LoopIn Backend
 *
 * Abstract data store contract. Both DynamoDbRepository and MemoryRepository implement this.
 */

import type { Item, Loan, UserProfile, CampusImpactSummary, SavedNeedRequest } from "@loopin/shared";

export interface ListItemsOptions {
  campusId?: string | undefined;
  category?: string | undefined;
  status?: string | undefined;
  search?: string | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

export interface UserAccount {
  userId: string;
  email: string;
  passwordHash: string;
  salt: string;
  displayName: string;
  campusId: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ILoopInRepository {
  // Accounts
  createAccount(account: UserAccount): Promise<UserAccount>;
  getAccountByEmail(email: string): Promise<UserAccount | null>;
  getAccountById(userId: string): Promise<UserAccount | null>;

  // Items
  createItem(item: Item): Promise<Item>;
  getItem(itemId: string): Promise<Item | null>;
  updateItem(item: Item): Promise<Item>;
  deleteItem(itemId: string): Promise<void>;
  listItems(options: ListItemsOptions): Promise<{ items: Item[]; nextCursor?: string }>;
  listItemsByOwner(ownerId: string): Promise<Item[]>;

  // Loans
  createLoan(loan: Loan): Promise<Loan>;
  getLoan(loanId: string): Promise<Loan | null>;
  updateLoan(loan: Loan): Promise<Loan>;
  listLoansByItem(itemId: string): Promise<Loan[]>;
  listLoansForUser(userId: string, role?: "borrower" | "lender", status?: string): Promise<Loan[]>;

  // Concurrency-safe atomic state transitions
  atomicApproveLoan(loanId: string, itemId: string, approvedAt: string): Promise<Loan>;
  atomicPickupLoan(loanId: string, itemId: string, borrowedAt: string): Promise<Loan>;
  atomicConfirmReturnLoan(loanId: string, itemId: string, returnedAt: string): Promise<Loan>;
  atomicReturnLoan(loanId: string, itemId: string, returnedAt: string): Promise<Loan>; // legacy alias

  // Profiles & Users
  getUserProfile(userId: string): Promise<UserProfile | null>;
  saveUserProfile(profile: UserProfile): Promise<UserProfile>;

  // Saved Need Requests
  saveNeedRequest(request: SavedNeedRequest): Promise<SavedNeedRequest>;
  listNeedRequests(userId: string): Promise<SavedNeedRequest[]>;

  // Impact & Stats
  getImpactSummary(campusId?: string): Promise<CampusImpactSummary>;
}
