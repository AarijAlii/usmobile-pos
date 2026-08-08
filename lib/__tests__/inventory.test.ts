import { describe, expect, it } from "vitest";
import { canFulfillQuantity, decrementQuantity } from "@/lib/inventory";

describe("canFulfillQuantity", () => {
  it("allows a request within available stock", () => {
    expect(canFulfillQuantity(10, 3)).toBe(true);
    expect(canFulfillQuantity(3, 3)).toBe(true);
  });

  it("rejects a request that exceeds available stock", () => {
    expect(canFulfillQuantity(2, 3)).toBe(false);
    expect(canFulfillQuantity(0, 1)).toBe(false);
  });

  it("rejects a non-positive request", () => {
    expect(canFulfillQuantity(10, 0)).toBe(false);
    expect(canFulfillQuantity(10, -1)).toBe(false);
  });
});

describe("decrementQuantity", () => {
  it("returns the remaining quantity after a valid decrement", () => {
    expect(decrementQuantity(10, 3)).toBe(7);
    expect(decrementQuantity(3, 3)).toBe(0);
  });

  it("throws rather than going negative", () => {
    expect(() => decrementQuantity(2, 3)).toThrow(/Cannot decrement/);
  });
});
