import { describe, expect, it } from "vitest";
import { calcSaleTotals, calcSubtotalCents, calcTaxCents, formatCents } from "@/lib/money";

describe("calcSubtotalCents", () => {
  it("sums unit price times quantity across line items", () => {
    expect(
      calcSubtotalCents([
        { unitPriceCents: 129900, quantity: 1 },
        { unitPriceCents: 1999, quantity: 2 },
      ]),
    ).toBe(129900 + 1999 * 2);
  });

  it("returns 0 for an empty cart", () => {
    expect(calcSubtotalCents([])).toBe(0);
  });
});

describe("calcTaxCents", () => {
  it("computes tax from basis points and rounds to the nearest cent", () => {
    // 7.25% of $19.99 = 144.9275 cents -> rounds to 145
    expect(calcTaxCents(1999, 725)).toBe(145);
  });

  it("returns 0 tax when the rate is 0", () => {
    expect(calcTaxCents(10000, 0)).toBe(0);
  });

  it("throws on negative input", () => {
    expect(() => calcTaxCents(-100, 725)).toThrow();
    expect(() => calcTaxCents(100, -1)).toThrow();
  });
});

describe("calcSaleTotals", () => {
  it("combines subtotal and tax into a total", () => {
    const totals = calcSaleTotals([{ unitPriceCents: 10000, quantity: 1 }], 1000);
    expect(totals).toEqual({ subtotalCents: 10000, taxCents: 1000, totalCents: 11000 });
  });
});

describe("formatCents", () => {
  it("formats cents as a USD currency string", () => {
    expect(formatCents(129900)).toBe("$1,299.00");
    expect(formatCents(0)).toBe("$0.00");
  });
});
