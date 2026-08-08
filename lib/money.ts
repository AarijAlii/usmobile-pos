/** All money in this app is stored and computed in integer cents to avoid float rounding errors. */

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export interface LineItemInput {
  unitPriceCents: number;
  quantity: number;
}

export function calcSubtotalCents(items: LineItemInput[]): number {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
}

/** taxRateBps is basis points (1/100th of a percent), e.g. 725 = 7.25%. */
export function calcTaxCents(subtotalCents: number, taxRateBps: number): number {
  if (subtotalCents < 0 || taxRateBps < 0) {
    throw new Error("subtotalCents and taxRateBps must be non-negative");
  }
  return Math.round((subtotalCents * taxRateBps) / 10_000);
}

export function calcSaleTotals(items: LineItemInput[], taxRateBps: number) {
  const subtotalCents = calcSubtotalCents(items);
  const taxCents = calcTaxCents(subtotalCents, taxRateBps);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
