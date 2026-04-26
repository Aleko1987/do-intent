import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HotkeyParser } from "./hotkeyParser";

describe("HotkeyParser", () => {
  it("starts and finalizes region when q is held", () => {
    const parser = new HotkeyParser({ holdThresholdMs: 180, doublePressWindowMs: 350 });
    assert.deepEqual(parser.onQKeyDown(1000), []);
    assert.deepEqual(parser.onTick(1190), [{ type: "region_start", at: 1000 }]);
    assert.deepEqual(parser.onQKeyUp(1250), [{ type: "region_finalize", at: 1250 }]);
  });

  it("triggers fullscreen on quick qq", () => {
    const parser = new HotkeyParser({ holdThresholdMs: 180, doublePressWindowMs: 350 });
    assert.deepEqual(parser.onQKeyDown(1000), []);
    assert.deepEqual(parser.onQKeyUp(1050), []);
    assert.deepEqual(parser.onQKeyDown(1200), [
      { type: "fullscreen_capture", at: 1200 },
    ]);
  });

  it("does nothing for short single press", () => {
    const parser = new HotkeyParser({ holdThresholdMs: 180, doublePressWindowMs: 350 });
    assert.deepEqual(parser.onQKeyDown(1000), []);
    assert.deepEqual(parser.onQKeyUp(1100), []);
  });
});
