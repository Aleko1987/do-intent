import { describe, expect, it } from "bun:test";
import { calculateIpRepeatBoost } from "./ip_boost";

describe("ip repeat-visit boost", () => {
  it("does not apply boost on first event", () => {
    const boost = calculateIpRepeatBoost(0, true, 2);
    expect(boost).toBe(0);
  });

  it("applies configured boost on repeat events", () => {
    const boost = calculateIpRepeatBoost(3, true, 2);
    expect(boost).toBe(2);
  });

  it("does not apply boost when disabled", () => {
    const boost = calculateIpRepeatBoost(5, false, 3);
    expect(boost).toBe(0);
  });
});
