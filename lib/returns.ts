export interface ReturnLineItemInput {
  unitPriceCents: number;
  quantity: number;
}

export function calcReturnableQuantity(originalQuantity: number, alreadyReturnedQuantity: number): number {
  return Math.max(0, originalQuantity - alreadyReturnedQuantity);
}

export function calcReturnSubtotalCents(items: ReturnLineItemInput[]): number {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
}

/**
 * Tax is refunded proportionally to the fraction of the original subtotal
 * being returned, using the tax actually charged on the sale — not the
 * store's current tax rate, which may have changed since the sale happened.
 */
export function calcProportionalTaxCents(
  saleSubtotalCents: number,
  saleTaxCents: number,
  returnedSubtotalCents: number,
): number {
  if (saleSubtotalCents <= 0) return 0;
  return Math.round((saleTaxCents * returnedSubtotalCents) / saleSubtotalCents);
}

export function calcReturnTotals(
  items: ReturnLineItemInput[],
  saleSubtotalCents: number,
  saleTaxCents: number,
) {
  const subtotalCents = calcReturnSubtotalCents(items);
  const taxCents = calcProportionalTaxCents(saleSubtotalCents, saleTaxCents, subtotalCents);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

export function wouldFullyRefundSale(
  saleTotalCents: number,
  alreadyRefundedCents: number,
  thisReturnTotalCents: number,
): boolean {
  return alreadyRefundedCents + thisReturnTotalCents >= saleTotalCents;
}
