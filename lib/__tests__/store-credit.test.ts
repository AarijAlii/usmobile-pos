import { describe, expect, it } from "vitest";
import { calcAppliedStoreCreditCents, calcRemainingAfterCredit } from "@/lib/store-credit";

describe("calcAppliedStoreCreditCents", () => {
  it("caps the applied amount at the available balance", () => {
    expect(calcAppliedStoreCreditCents(500, 2000)).toBe(500);
  });

  it("caps the applied amount at the cart total", () => {
    expect(calcAppliedStoreCreditCents(5000, 1200)).toBe(1200);
  });

  it("returns 0 when there is no balance or no total", () => {
    expect(calcAppliedStoreCreditCents(0, 1000)).toBe(0);
    expect(calcAppliedStoreCreditCents(1000, 0)).toBe(0);
  });
});

describe("calcRemainingAfterCredit", () => {
  it("subtracts the applied credit from the total", () => {
    expect(calcRemainingAfterCredit(2000, 500)).toBe(1500);
  });

  it("clamps at 0 when credit fully covers the total", () => {
    expect(calcRemainingAfterCredit(1000, 1000)).toBe(0);
    expect(calcRemainingAfterCredit(1000, 1500)).toBe(0);
  });
});
