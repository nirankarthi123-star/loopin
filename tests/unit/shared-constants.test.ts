/**
 * Unit tests — Shared utility functions
 */
import { describe, it, expect } from "vitest";
import { SCORE_TIERS, ITEM_CATEGORIES, ERROR_CODES, calculateRentalFee } from "@loopin/shared";

describe("calculateRentalFee", () => {
  it("should calculate rent proportional to number of days", () => {
    const cost = 10000; // ₹10,000 item
    const fee1Day = calculateRentalFee(cost, 1);
    const fee3Days = calculateRentalFee(cost, 3);
    const fee7Days = calculateRentalFee(cost, 7);

    expect(fee1Day).toBe(50); // 0.5% of 10,000 = ₹50
    expect(fee3Days).toBe(150); // ₹150
    expect(fee7Days).toBe(350); // ₹350
    expect(fee7Days).toBeGreaterThan(fee3Days);
    expect(fee3Days).toBeGreaterThan(fee1Day);
  });

  it("should strictly guarantee rent stays below 15% of cost price", () => {
    const cost = 10000;
    // 15% would be 1500
    // Test extreme number of days: 30 days, 60 days, 100 days
    const fee30Days = calculateRentalFee(cost, 30);
    const fee60Days = calculateRentalFee(cost, 60);
    const fee100Days = calculateRentalFee(cost, 100);

    // All must be strictly less than 15% of cost price (1500)
    expect(fee30Days).toBeLessThan(cost * 0.15);
    expect(fee60Days).toBeLessThan(cost * 0.15);
    expect(fee100Days).toBeLessThan(cost * 0.15);

    // Specifically capped at 14% max cap (1400)
    expect(fee30Days).toBe(1400);
    expect(fee60Days).toBe(1400);
    expect(fee100Days).toBe(1400);
  });

  it("should enforce a minimal floor and valid output for cheap items", () => {
    const cheapCost = 200; // ₹200 book
    const fee = calculateRentalFee(cheapCost, 1);
    expect(fee).toBeGreaterThanOrEqual(1);
    expect(fee).toBeLessThan(cheapCost * 0.15);
  });
});

describe("SCORE_TIERS", () => {
  it("should have platinum as the top tier with max 100", () => {
    expect(SCORE_TIERS.platinum.max).toBe(100);
  });

  it("should cover the full 0–100 range without gaps", () => {
    // new: 0-0, bronze: 1-39, silver: 40-69, gold: 70-89, platinum: 90-100
    const tiers = Object.values(SCORE_TIERS);
    const mins = tiers.map((t) => t.min).sort((a, b) => a - b);
    const maxes = tiers.map((t) => t.max).sort((a, b) => a - b);
    expect(mins[0]).toBe(0);
    expect(maxes[maxes.length - 1]).toBe(100);
  });
});

describe("ITEM_CATEGORIES", () => {
  it("should have a human-readable label for every category key", () => {
    for (const [, label] of Object.entries(ITEM_CATEGORIES)) {
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("should include electronics and books", () => {
    expect(ITEM_CATEGORIES.electronics).toBeDefined();
    expect(ITEM_CATEGORIES.books).toBeDefined();
  });
});

describe("ERROR_CODES", () => {
  it("should include all expected API error codes", () => {
    expect(ERROR_CODES.NOT_FOUND).toBe("NOT_FOUND");
    expect(ERROR_CODES.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(ERROR_CODES.FORBIDDEN).toBe("FORBIDDEN");
    expect(ERROR_CODES.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    expect(ERROR_CODES.CANNOT_BORROW_OWN_ITEM).toBe("CANNOT_BORROW_OWN_ITEM");
  });
});
