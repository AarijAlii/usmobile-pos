export type LayawayStatus = "ACTIVE" | "PAID_OFF" | "CANCELLED" | "FORFEITED";

export const LAYAWAY_STATUS_LABELS: Record<LayawayStatus, string> = {
  ACTIVE: "Active",
  PAID_OFF: "Paid Off",
  CANCELLED: "Cancelled",
  FORFEITED: "Forfeited",
};

export const LAYAWAY_STATUS_BADGE_VARIANT: Record<
  LayawayStatus,
  "secondary" | "success" | "destructive"
> = {
  ACTIVE: "secondary",
  PAID_OFF: "success",
  CANCELLED: "destructive",
  FORFEITED: "destructive",
};

/** Overdue is derived, not a stored status — there's no background job to flip it automatically, so staff see it computed here and act on it manually (record a payment, or mark it forfeited). */
export function isLayawayOverdue(
  status: LayawayStatus,
  dueDate: Date | string,
  now: Date = new Date(),
): boolean {
  if (status !== "ACTIVE") return false;
  return new Date(dueDate).getTime() < now.getTime();
}

export function calcRemainingCents(totalCents: number, paidCents: number): number {
  return Math.max(0, totalCents - paidCents);
}
