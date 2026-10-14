/**
 * In-Memory Local/Demo Repository — LoopIn Backend
 *
 * Implements ILoopInRepository using in-memory state.
 * Allows full local development, tests, and demo mode without requiring AWS credentials.
 */

import type { Item, Loan, UserProfile, CampusImpactSummary, SavedNeedRequest } from "@loopin/shared";
import type { ILoopInRepository, ListItemsOptions, UserAccount } from "./interface.js";
import { calculateCampusImpact } from "../domain/impactTracker.js";
import { ConflictError, NotFoundError } from "../domain/errors.js";

export class MemoryRepository implements ILoopInRepository {
  private accounts: Map<string, UserAccount> = new Map();
  private emailToId: Map<string, string> = new Map();
  private items: Map<string, Item> = new Map();
  private loans: Map<string, Loan> = new Map();
  private profiles: Map<string, UserProfile> = new Map();

  constructor(seedWithDemoData = false) {
    if (seedWithDemoData) {
      this.seed();
    }
  }

  // ── Accounts ────────────────────────────────────────────────────────────────

  async createAccount(account: UserAccount): Promise<UserAccount> {
    const normalizedEmail = account.email.toLowerCase().trim();
    if (this.emailToId.has(normalizedEmail)) {
      throw new ConflictError("An account with this email address already exists");
    }
    this.accounts.set(account.userId, account);
    this.emailToId.set(normalizedEmail, account.userId);

    // Seed profile automatically
    if (!this.profiles.has(account.userId)) {
      this.profiles.set(account.userId, {
        userId: account.userId,
        email: normalizedEmail,
        displayName: account.displayName,
        campusId: account.campusId,
        emailVerified: account.emailVerified,
        campusVerified: normalizedEmail.endsWith(".ac.in") || normalizedEmail.endsWith(".edu"),
        reliabilityScore: 70,
        totalSavings: 0,
        borrowCount: 0,
        lendCount: 0,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      });
    }

    return account;
  }

  async getAccountByEmail(email: string): Promise<UserAccount | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const userId = this.emailToId.get(normalizedEmail);
    if (!userId) return null;
    return this.accounts.get(userId) ?? null;
  }

  async getAccountById(userId: string): Promise<UserAccount | null> {
    return this.accounts.get(userId) ?? null;
  }

  public seed(): void {
    const demoUser: UserProfile = {
      userId: "demo-user-001",
      email: "niranjna.karthikeyan@vit.ac.in",
      displayName: "Niranjna Karthikeyan",
      campusId: "campus-vit-chennai",
      bio: "Computer Science student at VIT Chennai. Robotics & tech enthusiast.",
      reliabilityScore: 87,
      totalSavings: 34500,
      borrowCount: 14,
      lendCount: 22,
      createdAt: "2024-08-01T10:00:00Z",
      updatedAt: "2026-10-01T10:00:00Z",
    };
    this.profiles.set(demoUser.userId, demoUser);
    this.accounts.set(demoUser.userId, {
      userId: demoUser.userId,
      email: demoUser.email,
      passwordHash: "mock-hash",
      salt: "mock-salt",
      displayName: demoUser.displayName,
      campusId: demoUser.campusId,
      emailVerified: false,
      createdAt: demoUser.createdAt,
      updatedAt: demoUser.updatedAt,
    });
    this.emailToId.set(demoUser.email.toLowerCase(), demoUser.userId);

    const peerUser: UserProfile = {
      userId: "demo-user-002",
      email: "arjun.nair@vit.ac.in",
      displayName: "Arjun Nair",
      campusId: "campus-vit-chennai",
      reliabilityScore: 94,
      totalSavings: 42000,
      borrowCount: 8,
      lendCount: 31,
      createdAt: "2024-07-15T09:00:00Z",
      updatedAt: "2026-10-01T11:00:00Z",
    };
    this.profiles.set(peerUser.userId, peerUser);
    this.accounts.set(peerUser.userId, {
      userId: peerUser.userId,
      email: peerUser.email,
      passwordHash: "mock-hash",
      salt: "mock-salt",
      displayName: peerUser.displayName,
      campusId: peerUser.campusId,
      emailVerified: false,
      createdAt: peerUser.createdAt,
      updatedAt: peerUser.updatedAt,
    });
    this.emailToId.set(peerUser.email.toLowerCase(), peerUser.userId);

    const demoItems: Item[] = [
      {
        itemId: "item-001",
        ownerId: "demo-user-002",
        ownerName: "Arjun Nair",
        title: "Digital Multimeter (Fluke 115)",
        description: "True-RMS multimeter, perfect for EE labs and breadboard circuit debugging.",
        category: "electronics",
        estimatedValue: 8500,
        status: "available",
        condition: "like_new",
        tags: ["electronics", "hardware", "lab", "ee"],
        campusId: "campus-vit-chennai",
        createdAt: "2026-09-20T10:00:00Z",
        updatedAt: "2026-09-20T10:00:00Z",
      },
      {
        itemId: "item-002",
        ownerId: "demo-user-001",
        ownerName: "Niranjna Karthikeyan",
        title: "TI-84 Plus CE Graphing Calculator",
        description: "Color screen graphing calculator. Has Python support.",
        category: "electronics",
        estimatedValue: 6500,
        status: "available",
        condition: "good",
        tags: ["calculator", "math", "exam"],
        campusId: "campus-vit-chennai",
        createdAt: "2026-09-18T14:00:00Z",
        updatedAt: "2026-09-18T14:00:00Z",
      },
    ];

    for (const item of demoItems) {
      this.items.set(item.itemId, item);
    }
  }

  public reset(): void {
    this.items.clear();
    this.loans.clear();
    this.profiles.clear();
  }

  // ── Items ───────────────────────────────────────────────────────────────────

  async createItem(item: Item): Promise<Item> {
    this.items.set(item.itemId, { ...item });
    return { ...item };
  }

  async getItem(itemId: string): Promise<Item | null> {
    const item = this.items.get(itemId);
    return item ? { ...item } : null;
  }

  async updateItem(item: Item): Promise<Item> {
    if (!this.items.has(item.itemId)) {
      throw new NotFoundError("item", item.itemId);
    }
    this.items.set(item.itemId, { ...item });
    return { ...item };
  }

  async deleteItem(itemId: string): Promise<void> {
    this.items.delete(itemId);
  }

  async listItems(options: ListItemsOptions): Promise<{ items: Item[]; nextCursor?: string }> {
    let result = Array.from(this.items.values());

    if (options.campusId) {
      result = result.filter((i) => i.campusId === options.campusId);
    }
    if (options.category) {
      result = result.filter((i) => i.category === options.category);
    }
    if (options.status) {
      result = result.filter((i) => i.status === options.status);
    }
    if (options.search) {
      const q = options.search.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const limit = options.limit ?? 20;
    const items = result.slice(0, limit);
    return { items };
  }

  async listItemsByOwner(ownerId: string): Promise<Item[]> {
    return Array.from(this.items.values()).filter((i) => i.ownerId === ownerId);
  }

  // ── Loans ───────────────────────────────────────────────────────────────────

  async createLoan(loan: Loan): Promise<Loan> {
    this.loans.set(loan.loanId, { ...loan });
    return { ...loan };
  }

  async getLoan(loanId: string): Promise<Loan | null> {
    const loan = this.loans.get(loanId);
    return loan ? { ...loan } : null;
  }

  async updateLoan(loan: Loan): Promise<Loan> {
    if (!this.loans.has(loan.loanId)) {
      throw new NotFoundError("loan", loan.loanId);
    }
    this.loans.set(loan.loanId, { ...loan });
    return { ...loan };
  }

  async listLoansByItem(itemId: string): Promise<Loan[]> {
    return Array.from(this.loans.values()).filter((l) => l.itemId === itemId);
  }

  async listLoansForUser(
    userId: string,
    role?: "borrower" | "lender",
    status?: string,
  ): Promise<Loan[]> {
    let list = Array.from(this.loans.values());

    if (role === "borrower") {
      list = list.filter((l) => l.borrowerId === userId);
    } else if (role === "lender") {
      list = list.filter((l) => l.lenderId === userId);
    } else {
      list = list.filter((l) => l.borrowerId === userId || l.lenderId === userId);
    }

    if (status) {
      list = list.filter((l) => l.status === status);
    }

    list.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    return list;
  }

  // ── Concurrency-Safe Atomic Operations ──────────────────────────────────────

  async atomicApproveLoan(loanId: string, itemId: string, approvedAt: string): Promise<Loan> {
    const loan = this.loans.get(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    const item = this.items.get(itemId);
    if (!item) throw new NotFoundError("item", itemId);

    // Conditional check: loan must be pending
    if (loan.status !== "pending") {
      throw new ConflictError("Loan is no longer pending approval");
    }

    const updatedLoan: Loan = { ...loan, status: "approved", approvedAt };
    const updatedItem: Item = { ...item, status: "on_loan", updatedAt: approvedAt };

    this.loans.set(loanId, updatedLoan);
    this.items.set(itemId, updatedItem);

    return { ...updatedLoan };
  }

  async atomicPickupLoan(loanId: string, itemId: string, borrowedAt: string): Promise<Loan> {
    const loan = this.loans.get(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    const item = this.items.get(itemId);
    if (!item) throw new NotFoundError("item", itemId);

    if (loan.status !== "approved") {
      throw new ConflictError("Loan is not approved for pickup");
    }

    const updatedLoan: Loan = { ...loan, status: "borrowed", borrowedAt };
    const updatedItem: Item = { ...item, status: "on_loan", updatedAt: borrowedAt };

    this.loans.set(loanId, updatedLoan);
    this.items.set(itemId, updatedItem);

    return { ...updatedLoan };
  }

  async atomicConfirmReturnLoan(loanId: string, itemId: string, returnedAt: string): Promise<Loan> {
    const loan = this.loans.get(loanId);
    if (!loan) throw new NotFoundError("loan", loanId);

    const item = this.items.get(itemId);
    if (!item) throw new NotFoundError("item", itemId);

    const isReturnable =
      loan.status === "return_requested" || loan.status === "borrowed" || loan.status === "active";
    if (!isReturnable) {
      throw new ConflictError("Loan is not currently borrowed or pending return confirmation");
    }

    const updatedLoan: Loan = { ...loan, status: "completed", returnedAt };
    const updatedItem: Item = { ...item, status: "available", updatedAt: returnedAt };

    this.loans.set(loanId, updatedLoan);
    this.items.set(itemId, updatedItem);

    return { ...updatedLoan };
  }

  async atomicReturnLoan(loanId: string, itemId: string, returnedAt: string): Promise<Loan> {
    return this.atomicConfirmReturnLoan(loanId, itemId, returnedAt);
  }

  // ── Profiles ────────────────────────────────────────────────────────────────

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const profile = this.profiles.get(userId);
    return profile ? { ...profile } : null;
  }

  async saveUserProfile(profile: UserProfile): Promise<UserProfile> {
    this.profiles.set(profile.userId, { ...profile });
    return { ...profile };
  }

  // ── Saved Need Requests ─────────────────────────────────────────────────────

  private needRequests: SavedNeedRequest[] = [];

  async saveNeedRequest(request: SavedNeedRequest): Promise<SavedNeedRequest> {
    this.needRequests.push({ ...request });
    return { ...request };
  }

  async listNeedRequests(userId: string): Promise<SavedNeedRequest[]> {
    return this.needRequests.filter((r) => r.userId === userId);
  }

  // ── Impact ──────────────────────────────────────────────────────────────────

  async getImpactSummary(campusId = "campus-vit-chennai"): Promise<CampusImpactSummary> {
    const allLoans = Array.from(this.loans.values());
    return calculateCampusImpact(allLoans, this.profiles.size, campusId, "VIT Chennai");
  }
}
