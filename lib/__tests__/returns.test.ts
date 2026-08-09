import { describe, expect, it } from "vitest";
import {
  calcProportionalTaxCents,
  calcReturnSubtotalCents,
  calcReturnTotals,
  calcReturnableQuantity,
  wouldFullyRefundSale,
} from "@/lib/returns";

describe("calcReturnableQuantity", () => {
  it("returns the difference between original and already-returned quantity", () => {
    expect(calcReturnableQuantity(3, 1)).toBe(2);
  });

  it("clamps at 0 instead of going negative", () => {
    expect(calcReturnableQuantity(1, 1)).toBe(0);
    expect(calcReturnableQuantity(1, 2)).toBe(0);
  });
});

describe("calcReturnSubtotalCents", () => {
  it("sums unit price times quantity across returned line items", () => {
    expect(
      calcReturnSubtotalCents([
        { unitPriceCents: 129900, quantity: 1 },
        { unitPriceCents: 1999, quantity: 2 },
      ]),
    ).toBe(129900 + 1999 * 2);
  });

  it("returns 0 for no returned items", () => {
    expect(calcReturnSubtotalCents([])).toBe(0);
  });
});

describe("calcProportionalTaxCents", () => {
  it("refunds tax proportional to the returned share of the subtotal", () => {
    // Full return: refund all the tax that was charged.
    expect(calcProportionalTaxCents(10000, 725, 10000)).toBe(725);
    // Half the subtotal returned: half the tax refunded.
    expect(calcProportionalTaxCents(10000, 725, 5000)).toBe(363); // 362.5 rounds to 363
  });

  it("returns 0 when the original sale had no subtotal", () => {
    expect(calcProportionalTaxCents(0, 0, 0)).toBe(0);
  });
});

describe("calcReturnTotals", () => {
  it("combines returned subtotal with proportional tax", () => {
    const totals = calcReturnTotals([{ unitPriceCents: 5000, quantity: 1 }], 10000, 725);
    expect(totals).toEqual({ subtotalCents: 5000, taxCents: 363, totalCents: 5363 });
  });
});

describe("wouldFullyRefundSale", () => {
  it("is true once refunded total reaches the sale total", () => {
    expect(wouldFullyRefundSale(10000, 0, 10000)).toBe(true);
    expect(wouldFullyRefundSale(10000, 6000, 4000)).toBe(true);
  });

  it("is false while a balance remains", () => {
    expect(wouldFullyRefundSale(10000, 0, 5000)).toBe(false);
    expect(wouldFullyRefundSale(10000, 5000, 4999)).toBe(false);
  });
});
