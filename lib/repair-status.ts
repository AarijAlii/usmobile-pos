export type RepairStatus =
  | "INTAKE"
  | "DIAGNOSING"
  | "IN_REPAIR"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "CANCELLED";

/** Legal forward transitions for the repair ticket state machine. CANCELLED is reachable from any non-terminal state. */
const ALLOWED_TRANSITIONS: Record<RepairStatus, RepairStatus[]> = {
  INTAKE: ["DIAGNOSING", "CANCELLED"],
  DIAGNOSING: ["IN_REPAIR", "CANCELLED"],
  IN_REPAIR: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidRepairStatusTransition(
  from: RepairStatus,
  to: RepairStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertValidRepairStatusTransition(
  from: RepairStatus,
  to: RepairStatus,
): void {
  if (!isValidRepairStatusTransition(from, to)) {
    throw new Error(`Cannot transition repair ticket from ${from} to ${to}`);
  }
}

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  INTAKE: "Intake",
  DIAGNOSING: "Diagnosing",
  IN_REPAIR: "In Repair",
  READY_FOR_PICKUP: "Ready for Pickup",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Encodes ticket state at a glance: new work is neutral, active work is a warning (needs attention), done is success, cancelled is destructive. */
export const REPAIR_STATUS_BADGE_VARIANT: Record<
  RepairStatus,
  "secondary" | "warning" | "success" | "destructive"
> = {
  INTAKE: "secondary",
  DIAGNOSING: "warning",
  IN_REPAIR: "warning",
  READY_FOR_PICKUP: "success",
  COMPLETED: "success",
  CANCELLED: "destructive",
};
