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
