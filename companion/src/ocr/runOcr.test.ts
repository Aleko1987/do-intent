import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeOcrText } from "./runOcr.js";

describe("normalizeOcrText", () => {
  it("trims extra whitespace while preserving paragraph breaks", () => {
    const normalized = normalizeOcrText("  hello   \nworld \n\n\nnext  ");
    assert.equal(normalized, "hello\nworld\nnext");
  });
});
