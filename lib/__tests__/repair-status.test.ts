import { describe, expect, it } from "vitest";
import {
  assertValidRepairStatusTransition,
  isValidRepairStatusTransition,
} from "@/lib/repair-status";

describe("isValidRepairStatusTransition", () => {
  it("allows the normal forward workflow", () => {
    expect(isValidRepairStatusTransition("INTAKE", "DIAGNOSING")).toBe(true);
    expect(isValidRepairStatusTransition("DIAGNOSING", "IN_REPAIR")).toBe(true);
    expect(isValidRepairStatusTransition("IN_REPAIR", "READY_FOR_PICKUP")).toBe(true);
    expect(isValidRepairStatusTransition("READY_FOR_PICKUP", "COMPLETED")).toBe(true);
  });

  it("allows cancelling from any non-terminal state", () => {
    expect(isValidRepairStatusTransition("INTAKE", "CANCELLED")).toBe(true);
    expect(isValidRepairStatusTransition("IN_REPAIR", "CANCELLED")).toBe(true);
  });

  it("rejects skipping states", () => {
    expect(isValidRepairStatusTransition("INTAKE", "COMPLETED")).toBe(false);
    expect(isValidRepairStatusTransition("INTAKE", "READY_FOR_PICKUP")).toBe(false);
  });

  it("rejects moving backward", () => {
    expect(isValidRepairStatusTransition("IN_REPAIR", "INTAKE")).toBe(false);
  });

  it("rejects any transition out of a terminal state", () => {
    expect(isValidRepairStatusTransition("COMPLETED", "IN_REPAIR")).toBe(false);
    expect(isValidRepairStatusTransition("CANCELLED", "INTAKE")).toBe(false);
  });
});

describe("assertValidRepairStatusTransition", () => {
  it("does not throw for a legal transition", () => {
    expect(() => assertValidRepairStatusTransition("INTAKE", "DIAGNOSING")).not.toThrow();
  });

  it("throws for an illegal transition", () => {
    expect(() => assertValidRepairStatusTransition("INTAKE", "COMPLETED")).toThrow(
      /Cannot transition/,
    );
  });
});
