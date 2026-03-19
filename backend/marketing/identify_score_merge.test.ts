import { describe, expect, it } from "bun:test";
import { computeCumulativeIntentScore } from "./identify";

describe("identify cumulative score merge", () => {
  it("adds all donor anonymous scores to identified lead score", () => {
    const merged = computeCumulativeIntentScore(12, [4, 6, 10]);
    expect(merged).toBe(32);
  });

  it("normalizes invalid or negative donor values via carry-forward rules", () => {
    const merged = computeCumulativeIntentScore(-3, [5, -8, 2]);
    expect(merged).toBe(7);
  });
});
