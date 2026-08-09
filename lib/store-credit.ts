export function calcAppliedStoreCreditCents(balanceCents: number, totalCents: number): number {
  if (balanceCents <= 0 || totalCents <= 0) return 0;
  return Math.min(balanceCents, totalCents);
}

export function calcRemainingAfterCredit(totalCents: number, appliedCents: number): number {
  return Math.max(0, totalCents - appliedCents);
}
