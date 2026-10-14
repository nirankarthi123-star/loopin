import { z } from "zod";

const ITEM_CATEGORIES = [
  "electronics",
  "books",
  "sports",
  "tools",
  "stationery",
  "kitchen",
  "clothing",
  "musical_instruments",
  "other",
] as const;

const ITEM_CONDITIONS = ["new", "like_new", "good", "fair"] as const;
const ITEM_STATUSES = ["available", "on_loan", "unavailable"] as const;

export const CreateItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description cannot exceed 1000 characters"),
  category: z.enum(ITEM_CATEGORIES),
  condition: z.enum(ITEM_CONDITIONS),
  estimatedValue: z
    .number()
    .positive("Estimated value must be greater than 0")
    .max(100000, "Estimated value exceeds limit"),
  imageUrl: z
    .string()
    .url("Image URL must be a valid URL")
    .optional(),
  tags: z
    .array(z.string().trim().min(2).max(30))
    .max(10, "Cannot specify more than 10 tags")
    .default([]),
});

export type CreateItemInput = z.infer<typeof CreateItemSchema>;

export const PatchItemSchema = z.object({
  title: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().min(10).max(1000).optional(),
  category: z.enum(ITEM_CATEGORIES).optional(),
  condition: z.enum(ITEM_CONDITIONS).optional(),
  estimatedValue: z.number().positive().max(100000).optional(),
  imageUrl: z.string().url().optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  tags: z.array(z.string().trim().min(2).max(30)).max(10).optional(),
});

export type PatchItemInput = z.infer<typeof PatchItemSchema>;

export const QueryItemsSchema = z.object({
  category: z.enum(ITEM_CATEGORIES).optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  campusId: z.string().optional(),
  search: z.string().trim().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type QueryItemsInput = z.infer<typeof QueryItemsSchema>;
