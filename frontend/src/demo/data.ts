/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Demo Data Layer — LoopIn
 *
 * This module provides realistic mock data used in VITE_APP_MODE=demo.
 * It is clearly labelled as mock data and must NEVER be passed off as
 * real cloud data to the user.
 *
 * All monetary values are in Indian Rupees (₹ / INR).
 * Rental fees are calculated at 0.5% of cost price per day, strictly capped
 * below 15% of the item's estimated replacement value.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { UserProfile, Item, Loan, Notification } from "@loopin/shared";

// ── Demo Users ─────────────────────────────────────────────────────────────────

export const DEMO_CURRENT_USER: UserProfile = {
  userId: "demo-user-001",
  email: "niranjna.karthikeyan@vit.ac.in",
  displayName: "Niranjna Karthikeyan",
  campusId: "campus-vit-chennai",
  bio: "Computer Science student at VIT Chennai. Passionate about robotics and circular tech!",
  reliabilityScore: 87,
  totalSavings: 105400,  // ₹1,05,400
  borrowCount: 14,
  lendCount: 22,
  createdAt: "2024-08-01T10:00:00Z",
  updatedAt: "2026-09-15T08:30:00Z",
};

export const DEMO_USERS: UserProfile[] = [
  DEMO_CURRENT_USER,
  {
    userId: "demo-user-002",
    email: "arjun.nair@vit.ac.in",
    displayName: "Arjun Nair",
    campusId: "campus-vit-chennai",
    reliabilityScore: 94,
    totalSavings: 178500,  // ₹1,78,500
    borrowCount: 8,
    lendCount: 31,
    createdAt: "2024-07-15T09:00:00Z",
    updatedAt: "2026-10-01T11:00:00Z",
  },
  {
    userId: "demo-user-003",
    email: "kavya.menon@vit.ac.in",
    displayName: "Kavya Menon",
    campusId: "campus-vit-chennai",
    reliabilityScore: 72,
    totalSavings: 57800,   // ₹57,800
    borrowCount: 19,
    lendCount: 11,
    createdAt: "2025-01-10T14:00:00Z",
    updatedAt: "2026-10-05T16:00:00Z",
  },
];

// ── Demo Items ─────────────────────────────────────────────────────────────────

export const DEMO_ITEMS: Item[] = [
  {
    itemId: "item-001",
    ownerId: "demo-user-002",
    ownerName: "Arjun Nair",
    title: "Texas Instruments TI-84 Plus",
    description: "Scientific graphing calculator. Perfect for Maths and Physics courses. Comes with cover.",
    category: "electronics",
    estimatedValue: 10200,   // ₹10,200
    imageUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80",
    status: "available",
    condition: "like_new",
    tags: ["calculator", "math", "engineering"],
    campusId: "campus-vit-chennai",
    createdAt: "2026-08-10T10:00:00Z",
    updatedAt: "2026-09-20T12:00:00Z",
  },
  {
    itemId: "item-002",
    ownerId: "demo-user-001",
    ownerName: "Niranjna Karthikeyan",
    title: "Digital Multimeter",
    description: "Fluke 115 True-RMS digital multimeter. Ideal for electronics lab. All probes included.",
    category: "tools",
    estimatedValue: 8075,    // ₹8,075
    imageUrl: "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=400&q=80",
    status: "on_loan",
    condition: "good",
    tags: ["electronics", "lab", "measurement"],
    campusId: "campus-vit-chennai",
    createdAt: "2026-07-01T08:00:00Z",
    updatedAt: "2026-10-01T09:00:00Z",
  },
  {
    itemId: "item-003",
    ownerId: "demo-user-003",
    ownerName: "Kavya Menon",
    title: "DSLR Camera — Canon EOS 200D",
    description: "Great for projects, photography club, events. Comes with 18-55mm kit lens and charger.",
    category: "electronics",
    estimatedValue: 38250,   // ₹38,250
    imageUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80",
    status: "available",
    condition: "good",
    tags: ["camera", "photography", "project"],
    campusId: "campus-vit-chennai",
    createdAt: "2026-06-15T11:00:00Z",
    updatedAt: "2026-10-08T14:00:00Z",
  },
  {
    itemId: "item-004",
    ownerId: "demo-user-002",
    ownerName: "Arjun Nair",
    title: "Introduction to Algorithms — CLRS 4th Ed.",
    description: "Cormen et al. Classic algorithms textbook. Good condition, no annotations.",
    category: "books",
    estimatedValue: 6800,    // ₹6,800
    status: "available",
    condition: "good",
    tags: ["algorithms", "cs", "textbook"],
    campusId: "campus-vit-chennai",
    createdAt: "2026-09-01T09:00:00Z",
    updatedAt: "2026-09-01T09:00:00Z",
  },
  {
    itemId: "item-005",
    ownerId: "demo-user-001",
    ownerName: "Niranjna Karthikeyan",
    title: "Badminton Rackets Set (2)",
    description: "Yonex Voltric pair + 2 shuttlecock tubes. Great for recreational play.",
    category: "sports",
    estimatedValue: 5100,    // ₹5,100
    imageUrl: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=400&q=80",
    status: "available",
    condition: "like_new",
    tags: ["badminton", "sports", "racket"],
    campusId: "campus-vit-chennai",
    createdAt: "2026-09-10T07:00:00Z",
    updatedAt: "2026-09-10T07:00:00Z",
  },
  {
    itemId: "item-006",
    ownerId: "demo-user-003",
    ownerName: "Kavya Menon",
    title: "Portable Projector — Anker Nebula",
    description: "100-inch projection. Perfect for movie nights or presentations. Comes with HDMI cable.",
    category: "electronics",
    estimatedValue: 23800,   // ₹23,800
    status: "available",
    condition: "like_new",
    tags: ["projector", "presentation", "movie"],
    campusId: "campus-vit-chennai",
    createdAt: "2026-10-02T15:00:00Z",
    updatedAt: "2026-10-02T15:00:00Z",
  },
];

// ── Demo Loans ─────────────────────────────────────────────────────────────────
// Rental fee = 0.5% × cost × days, capped strictly below 15% of cost price.

export const DEMO_LOANS: Loan[] = [
  {
    loanId: "loan-001",
    itemId: "item-002",
    itemTitle: "Digital Multimeter",
    borrowerId: "demo-user-003",
    borrowerName: "Kavya Menon",
    lenderId: "demo-user-001",
    lenderName: "Niranjna Karthikeyan",
    status: "active",
    requestedAt: "2026-10-01T09:00:00Z",
    approvedAt: "2026-10-01T10:00:00Z",
    dueDate: "2026-10-15T23:59:59Z",
    durationDays: 14,
    rentalFee: 565,    // ₹565 = 0.5%/day × 14d × ₹8,075 (< 15% cap = ₹1,131)
    savingsValue: 8075,
    borrowerNote: "Need it for the circuits lab assignment.",
  },
  {
    loanId: "loan-002",
    itemId: "item-001",
    itemTitle: "TI-84 Plus Calculator",
    borrowerId: "demo-user-001",
    borrowerName: "Niranjna Karthikeyan",
    lenderId: "demo-user-002",
    lenderName: "Arjun Nair",
    status: "returned",
    requestedAt: "2026-09-01T08:00:00Z",
    approvedAt: "2026-09-01T09:00:00Z",
    dueDate: "2026-09-08T23:59:59Z",
    returnedAt: "2026-09-07T15:00:00Z",
    durationDays: 7,
    rentalFee: 357,    // ₹357 = 0.5%/day × 7d × ₹10,200 (< 15% cap = ₹1,428)
    savingsValue: 10200,
    borrowerNote: "Needed for the math end-semester exam.",
  },
  {
    loanId: "loan-003",
    itemId: "item-003",
    itemTitle: "Canon EOS 200D",
    borrowerId: "demo-user-001",
    borrowerName: "Niranjna Karthikeyan",
    lenderId: "demo-user-003",
    lenderName: "Kavya Menon",
    status: "pending",
    requestedAt: "2026-10-10T12:00:00Z",
    dueDate: "2026-10-17T23:59:59Z",
    durationDays: 7,
    rentalFee: 1339,   // ₹1,339 = 0.5%/day × 7d × ₹38,250 (< 15% cap = ₹5,355)
    savingsValue: 38250,
    borrowerNote: "For the robotics team showcase photos.",
  },
];

// ── Demo Notifications ─────────────────────────────────────────────────────────

export const DEMO_NOTIFICATIONS: Notification[] = [
  {
    notificationId: "notif-001",
    userId: "demo-user-001",
    type: "loan_requested",
    loanId: "loan-003",
    message: "You requested to borrow Canon EOS 200D from Kavya Menon.",
    read: false,
    createdAt: "2026-10-10T12:00:00Z",
  },
  {
    notificationId: "notif-002",
    userId: "demo-user-001",
    type: "due_tomorrow",
    loanId: "loan-001",
    message: "Reminder: Digital Multimeter is due back tomorrow.",
    read: false,
    createdAt: "2026-10-14T08:00:00Z",
  },
  {
    notificationId: "notif-003",
    userId: "demo-user-001",
    type: "item_returned",
    loanId: "loan-002",
    message: "TI-84 Plus Calculator was returned. Your reliability score improved!",
    read: true,
    createdAt: "2026-09-07T15:05:00Z",
  },
];

// ── Community Stats ────────────────────────────────────────────────────────────

export const DEMO_COMMUNITY_STATS = {
  totalItems: 148,
  activeLoans: 34,
  totalSavings: 1572500,  // ₹15,72,500
  campusName: "VIT Chennai",
  membersCount: 312,
};
