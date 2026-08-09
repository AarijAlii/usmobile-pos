import { describe, expect, it } from "vitest";
import { isLayawayOverdue, calcRemainingCents } from "@/lib/layaway";

describe("isLayawayOverdue", () => {
  const now = new Date("2026-06-15T00:00:00Z");

  it("is overdue when the due date has passed and the layaway is still active", () => {
    expect(isLayawayOverdue("ACTIVE", "2026-06-01T00:00:00Z", now)).toBe(true);
  });

  it("is not overdue when the due date is in the future", () => {
    expect(isLayawayOverdue("ACTIVE", "2026-07-01T00:00:00Z", now)).toBe(false);
  });

  it("is never overdue once resolved, even past the due date", () => {
    expect(isLayawayOverdue("PAID_OFF", "2026-06-01T00:00:00Z", now)).toBe(false);
    expect(isLayawayOverdue("CANCELLED", "2026-06-01T00:00:00Z", now)).toBe(false);
    expect(isLayawayOverdue("FORFEITED", "2026-06-01T00:00:00Z", now)).toBe(false);
  });
});

describe("calcRemainingCents", () => {
  it("returns the difference between total and paid", () => {
    expect(calcRemainingCents(10000, 3000)).toBe(7000);
  });

  it("never goes negative, even if overpaid", () => {
    expect(calcRemainingCents(10000, 12000)).toBe(0);
  });
});
