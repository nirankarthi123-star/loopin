/**
 * Mock Repository — LoopIn
 *
 * The single source of truth for in-memory demo state.
 * Components NEVER import from @/demo/data directly —
 * they use the service layer which delegates here.
 *
 * This repository is replaceable: swap the import in
 * services/index.ts to switch from mock → real AWS calls.
 */

import type {
  Item,
  Loan,
  UserProfile,
  Notification,
  CreateItemRequest,
  UpdateItemRequest,
  CreateLoanRequest,
} from "@loopin/shared";
import {
  DEMO_CURRENT_USER,
  DEMO_USERS,
  DEMO_ITEMS,
  DEMO_LOANS,
  DEMO_NOTIFICATIONS,
  DEMO_COMMUNITY_STATS,
} from "@/demo/data.ts";
import type { CommunityStats, ItemFilters, LoanFilters, ItemDetail } from "./types.ts";

// ── Mutable in-memory state ───────────────────────────────────────────────────
// Use copies of the imported arrays so mutations are isolated to this module.

let _items: Item[] = [...DEMO_ITEMS];
let _loans: Loan[] = [...DEMO_LOANS];
let _notifications: Notification[] = [...DEMO_NOTIFICATIONS];
let _currentUser: UserProfile = { ...DEMO_CURRENT_USER };

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function sleep(ms = 350): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Current User ──────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<UserProfile> {
  await sleep();
  return { ..._currentUser };
}

export async function updateCurrentUser(
  patch: Partial<Pick<UserProfile, "displayName" | "bio">>,
): Promise<UserProfile> {
  await sleep();
  _currentUser = { ..._currentUser, ...patch, updatedAt: new Date().toISOString() };
  return { ..._currentUser };
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function listItems(filters: ItemFilters = {}): Promise<Item[]> {
  await sleep();
  let results = [..._items];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  if (filters.category && filters.category !== "all") {
    results = results.filter((i) => i.category === filters.category);
  }

  if (filters.condition && filters.condition !== "all") {
    results = results.filter((i) => i.condition === filters.condition);
  }

  if (filters.status && filters.status !== "all") {
    results = results.filter((i) => i.status === filters.status);
  }

  switch (filters.sortBy) {
    case "oldest":
      results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case "value_desc":
      results.sort((a, b) => b.estimatedValue - a.estimatedValue);
      break;
    case "value_asc":
      results.sort((a, b) => a.estimatedValue - b.estimatedValue);
      break;
    default: // newest
      results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return results;
}

export async function getItem(itemId: string): Promise<ItemDetail | null> {
  await sleep();
  const item = _items.find((i) => i.itemId === itemId);
  if (!item) return null;

  const owner = DEMO_USERS.find((u) => u.userId === item.ownerId);
  return {
    ...item,
    owner: {
      displayName: owner?.displayName ?? "Unknown",
      reliabilityScore: owner?.reliabilityScore ?? 0,
      campusId: owner?.campusId ?? "",
    },
  };
}

export async function listMyItems(): Promise<Item[]> {
  await sleep();
  return _items.filter((i) => i.ownerId === _currentUser.userId);
}

export async function createItem(req: CreateItemRequest): Promise<Item> {
  await sleep();
  const now = new Date().toISOString();
  const newItem: Item = {
    itemId: generateId("item"),
    ownerId: _currentUser.userId,
    ownerName: _currentUser.displayName,
    title: req.title,
    description: req.description,
    category: req.category,
    estimatedValue: req.estimatedValue,
    condition: req.condition,
    tags: req.tags,
    status: "available",
    campusId: _currentUser.campusId,
    createdAt: now,
    updatedAt: now,
    ...(req.imageUrl !== undefined ? { imageUrl: req.imageUrl } : {}),
  };
  _items = [newItem, ..._items];
  return { ...newItem };
}

export async function updateItem(
  itemId: string,
  req: UpdateItemRequest,
): Promise<Item> {
  await sleep();
  const idx = _items.findIndex((i) => i.itemId === itemId);
  if (idx === -1) throw new Error("Item not found");
  const updated: Item = {
    ..._items[idx]!,
    ...req,
    updatedAt: new Date().toISOString(),
  };
  _items = _items.map((i) => (i.itemId === itemId ? updated : i));
  return { ...updated };
}

export async function deleteItem(itemId: string): Promise<void> {
  await sleep();
  _items = _items.filter((i) => i.itemId !== itemId);
}

// ── Loans ─────────────────────────────────────────────────────────────────────

export async function listLoans(filters: LoanFilters = {}): Promise<Loan[]> {
  await sleep();
  let results = [..._loans];

  if (filters.role === "borrower") {
    results = results.filter((l) => l.borrowerId === _currentUser.userId);
  } else if (filters.role === "lender") {
    results = results.filter((l) => l.lenderId === _currentUser.userId);
  } else {
    // default: all loans involving current user
    results = results.filter(
      (l) =>
        l.borrowerId === _currentUser.userId || l.lenderId === _currentUser.userId,
    );
  }

  if (filters.status) {
    results = results.filter((l) => l.status === filters.status);
  }

  return results.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export async function requestLoan(req: CreateLoanRequest): Promise<Loan> {
  await sleep();
  const item = _items.find((i) => i.itemId === req.itemId);
  if (!item) throw new Error("Item not found");
  if (item.status !== "available") throw new Error("Item is not available");
  if (item.ownerId === _currentUser.userId)
    throw new Error("You cannot borrow your own item");

  const now = new Date().toISOString();
  const newLoan: Loan = {
    loanId: generateId("loan"),
    itemId: req.itemId,
    itemTitle: item.title,
    borrowerId: _currentUser.userId,
    borrowerName: _currentUser.displayName,
    lenderId: item.ownerId,
    lenderName: item.ownerName,
    status: "pending",
    requestedAt: now,
    dueDate: req.dueDate,
    savingsValue: item.estimatedValue,
    ...(req.borrowerNote !== undefined ? { borrowerNote: req.borrowerNote } : {}),
  };

  _loans = [newLoan, ..._loans];
  // Mark item as on_loan optimistically
  _items = _items.map((i) =>
    i.itemId === req.itemId ? { ...i, status: "on_loan", updatedAt: now } : i,
  );

  return { ...newLoan };
}

export async function cancelLoan(loanId: string): Promise<Loan> {
  await sleep();
  const loan = _loans.find((l) => l.loanId === loanId);
  if (!loan) throw new Error("Loan not found");
  if (loan.borrowerId !== _currentUser.userId) throw new Error("Not authorised");
  if (loan.status !== "pending") throw new Error("Only pending loans can be cancelled");

  const updated: Loan = { ...loan, status: "cancelled" };
  _loans = _loans.map((l) => (l.loanId === loanId ? updated : l));
  // Restore item status
  _items = _items.map((i) =>
    i.itemId === loan.itemId ? { ...i, status: "available" } : i,
  );

  return { ...updated };
}

export async function approveLoan(loanId: string): Promise<Loan> {
  await sleep();
  const loan = _loans.find((l) => l.loanId === loanId);
  if (!loan) throw new Error("Loan not found");
  if (loan.lenderId !== _currentUser.userId) throw new Error("Not authorised");
  if (loan.status !== "pending") throw new Error("Only pending loans can be approved");

  const now = new Date().toISOString();
  const updated: Loan = { ...loan, status: "active", approvedAt: now };
  _loans = _loans.map((l) => (l.loanId === loanId ? updated : l));
  return { ...updated };
}

export async function rejectLoan(loanId: string): Promise<Loan> {
  await sleep();
  const loan = _loans.find((l) => l.loanId === loanId);
  if (!loan) throw new Error("Loan not found");
  if (loan.lenderId !== _currentUser.userId) throw new Error("Not authorised");
  if (loan.status !== "pending") throw new Error("Only pending loans can be rejected");

  const updated: Loan = { ...loan, status: "rejected" };
  _loans = _loans.map((l) => (l.loanId === loanId ? updated : l));
  _items = _items.map((i) =>
    i.itemId === loan.itemId ? { ...i, status: "available" } : i,
  );
  return { ...updated };
}

export async function markReturned(loanId: string): Promise<Loan> {
  await sleep();
  const loan = _loans.find((l) => l.loanId === loanId);
  if (!loan) throw new Error("Loan not found");
  if (loan.lenderId !== _currentUser.userId) throw new Error("Not authorised");
  if (loan.status !== "active") throw new Error("Only active loans can be marked returned");

  const now = new Date().toISOString();
  const updated: Loan = { ...loan, status: "returned", returnedAt: now };
  _loans = _loans.map((l) => (l.loanId === loanId ? updated : l));
  _items = _items.map((i) =>
    i.itemId === loan.itemId ? { ...i, status: "available", updatedAt: now } : i,
  );
  return { ...updated };
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function listNotifications(): Promise<Notification[]> {
  await sleep(150);
  return [..._notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  _notifications = _notifications.map((n) =>
    n.notificationId === notificationId ? { ...n, read: true } : n,
  );
}

// ── Community Stats ───────────────────────────────────────────────────────────

export async function getCommunityStats(): Promise<CommunityStats> {
  await sleep(200);
  return {
    ...DEMO_COMMUNITY_STATS,
    completedLoans: _loans.filter((l) => l.status === "returned").length,
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  await sleep();
  if (userId === _currentUser.userId) return { ..._currentUser };
  return DEMO_USERS.find((u) => u.userId === userId) ?? null;
}
