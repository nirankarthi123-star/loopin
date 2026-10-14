import { describe, it, expect } from "vitest";
import { CreateItemSchema, PatchItemSchema, QueryItemsSchema } from "@loopin/backend/schemas/items.schema.js";
import { CreateLoanSchema } from "@loopin/backend/schemas/loans.schema.js";

describe("Backend Validation Schemas (Zod)", () => {
  describe("CreateItemSchema", () => {
    it("should accept valid item data", () => {
      const valid = {
        title: "Arduino Uno Rev3",
        description: "Official micro-controller board in working condition.",
        category: "electronics",
        condition: "good",
        estimatedValue: 25,
        tags: ["arduino", "electronics", "lab"],
      };
      const result = CreateItemSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject title shorter than 3 chars", () => {
      const invalid = {
        title: "AB",
        description: "Valid description of the item.",
        category: "electronics",
        condition: "good",
        estimatedValue: 25,
      };
      const result = CreateItemSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("at least 3 characters");
      }
    });

    it("should reject description shorter than 10 chars", () => {
      const invalid = {
        title: "Valid Title",
        description: "Too short",
        category: "electronics",
        condition: "good",
        estimatedValue: 25,
      };
      const result = CreateItemSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("at least 10 characters");
      }
    });

    it("should reject negative or zero estimated value", () => {
      const invalid = {
        title: "Valid Title",
        description: "Valid description with enough chars.",
        category: "electronics",
        condition: "good",
        estimatedValue: 0,
      };
      const result = CreateItemSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid category", () => {
      const invalid = {
        title: "Valid Title",
        description: "Valid description with enough chars.",
        category: "rocket_ship",
        condition: "good",
        estimatedValue: 25,
      };
      const result = CreateItemSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("CreateLoanSchema", () => {
    it("should accept valid loan request with future date", () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const valid = {
        itemId: "item-12345",
        dueDate: futureDate,
        borrowerNote: "Needed for exam prep.",
      };
      const result = CreateLoanSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject past due date", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const invalid = {
        itemId: "item-12345",
        dueDate: pastDate,
      };
      const result = CreateLoanSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("must be in the future");
      }
    });

    it("should reject due date more than 30 days in the future", () => {
      const farFutureDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();
      const invalid = {
        itemId: "item-12345",
        dueDate: farFutureDate,
      };
      const result = CreateLoanSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("QueryItemsSchema", () => {
    it("should coerce string limits to numbers and apply default", () => {
      const parsed = QueryItemsSchema.parse({ limit: "50" });
      expect(parsed.limit).toBe(50);
    });

    it("should default limit to 20", () => {
      const parsed = QueryItemsSchema.parse({});
      expect(parsed.limit).toBe(20);
    });
  });
});
