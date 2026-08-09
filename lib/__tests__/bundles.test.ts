import { describe, expect, it } from "vitest";
import { allocateBundleDiscount } from "@/lib/bundles";

describe("allocateBundleDiscount", () => {
  it("splits the bundle price proportionally across components", () => {
    // $30 case + $10 charger = $40 individual, bundle sells for $32 (20% off)
    const allocations = allocateBundleDiscount(3200, [
      { unitPriceCents: 3000, quantity: 1 },
      { unitPriceCents: 1000, quantity: 1 },
    ]);
    expect(allocations).toEqual([2400, 800]);
    expect(allocations.reduce((a, b) => a + b, 0)).toBe(3200);
  });

  it("always sums to exactly the bundle price despite rounding", () => {
    // $10, $10, $10 individually = $30, bundle sells for $20 -> thirds don't divide evenly
    const allocations = allocateBundleDiscount(2000, [
      { unitPriceCents: 1000, quantity: 1 },
      { unitPriceCents: 1000, quantity: 1 },
      { unitPriceCents: 1000, quantity: 1 },
    ]);
    expect(allocations.reduce((a, b) => a + b, 0)).toBe(2000);
  });

  it("gives a single component the full bundle price", () => {
    expect(allocateBundleDiscount(1500, [{ unitPriceCents: 2000, quantity: 1 }])).toEqual([1500]);
  });

  it("returns all zeros when the components have no price", () => {
    expect(
      allocateBundleDiscount(1000, [
        { unitPriceCents: 0, quantity: 1 },
        { unitPriceCents: 0, quantity: 2 },
      ]),
    ).toEqual([0, 0]);
  });

  it("returns an empty array for no components", () => {
    expect(allocateBundleDiscount(1000, [])).toEqual([]);
  });
});
