export interface BundleComponentInput {
  unitPriceCents: number;
  quantity: number;
}

/**
 * Splits a bundle's fixed price across its components, proportional to each
 * component's share of the combined individual price. The last component
 * absorbs the rounding remainder so the parts always sum to exactly
 * bundlePriceCents — necessary because a bundle expands into one
 * SaleLineItem per component at checkout, and returns/restocking operate
 * per line item.
 */
export function allocateBundleDiscount(
  bundlePriceCents: number,
  components: BundleComponentInput[],
): number[] {
  if (components.length === 0) return [];

  const individualTotalCents = components.reduce(
    (sum, c) => sum + c.unitPriceCents * c.quantity,
    0,
  );
  if (individualTotalCents <= 0) return components.map(() => 0);

  const allocations = components.map((c) =>
    Math.round((bundlePriceCents * (c.unitPriceCents * c.quantity)) / individualTotalCents),
  );
  const allocatedBeforeLast = allocations.slice(0, -1).reduce((sum, a) => sum + a, 0);
  allocations[allocations.length - 1] = bundlePriceCents - allocatedBeforeLast;
  return allocations;
}
