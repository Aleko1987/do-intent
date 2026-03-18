import { describe, expect, it } from "bun:test";
import { computeCarryForwardScore } from "./carry_forward";

describe("identify carry-forward scoring", () => {
  it("adds anonymous subject score to current lead score", () => {
    expect(computeCarryForwardScore(12, 8)).toBe(20);
  });

  it("normalizes negative values to zero", () => {
    expect(computeCarryForwardScore(-2, 5)).toBe(5);
    expect(computeCarryForwardScore(10, -4)).toBe(10);
  });
});
