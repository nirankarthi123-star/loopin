import { z } from "zod";

const LOAN_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "borrowed",
  "return_requested",
  "completed",
  "cancelled",
  "active",
  "returned",
  "overdue",
] as const;

export const CreateLoanSchema = z.object({
  itemId: z.string().trim().min(1, "itemId is required"),
  dueDate: z
    .string()
    .datetime({ message: "dueDate must be a valid ISO-8601 string" })
    .refine(
      (val) => {
        const target = new Date(val).getTime();
        const now = Date.now();
        const maxDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 days
        return target > now && target <= now + maxDurationMs;
      },
      { message: "dueDate must be in the future and cannot exceed 30 days from now" },
    ),
  borrowerNote: z
    .string()
    .trim()
    .max(500, "Note cannot exceed 500 characters")
    .optional(),
  wouldHavePurchased: z.boolean().optional(),
});

export type CreateLoanInput = z.infer<typeof CreateLoanSchema>;

export const QueryLoansSchema = z.object({
  role: z.enum(["borrower", "lender"]).optional(),
  status: z.enum(LOAN_STATUSES).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type QueryLoansInput = z.infer<typeof QueryLoansSchema>;
