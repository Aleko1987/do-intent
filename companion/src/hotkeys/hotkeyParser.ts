export interface HotkeyParserConfig {
  holdThresholdMs: number;
  doublePressWindowMs: number;
}

export type HotkeyAction =
  | { type: "region_start"; at: number }
  | { type: "region_finalize"; at: number }
  | { type: "fullscreen_capture"; at: number };

export class HotkeyParser {
  private readonly holdThresholdMs: number;
  private readonly doublePressWindowMs: number;
  private lastQKeyDownAt: number | null = null;
  private lastQKeyUpAt: number | null = null;
  private regionActive = false;

  constructor(config: HotkeyParserConfig) {
    this.holdThresholdMs = config.holdThresholdMs;
    this.doublePressWindowMs = config.doublePressWindowMs;
  }

  onQKeyDown(at: number): HotkeyAction[] {
    const actions: HotkeyAction[] = [];
    this.lastQKeyDownAt = at;

    if (
      this.lastQKeyUpAt !== null &&
      at - this.lastQKeyUpAt <= this.doublePressWindowMs
    ) {
      this.regionActive = false;
      this.lastQKeyDownAt = null;
      actions.push({ type: "fullscreen_capture", at });
      return actions;
    }

    return actions;
  }

  onTick(at: number): HotkeyAction[] {
    const actions: HotkeyAction[] = [];
    if (
      this.lastQKeyDownAt !== null &&
      !this.regionActive &&
      at - this.lastQKeyDownAt >= this.holdThresholdMs
    ) {
      this.regionActive = true;
      actions.push({ type: "region_start", at: this.lastQKeyDownAt });
    }
    return actions;
  }

  onQKeyUp(at: number): HotkeyAction[] {
    const actions: HotkeyAction[] = [];
    this.lastQKeyUpAt = at;
    this.lastQKeyDownAt = null;

    if (this.regionActive) {
      actions.push({ type: "region_finalize", at });
      this.regionActive = false;
    }

    return actions;
  }
}
