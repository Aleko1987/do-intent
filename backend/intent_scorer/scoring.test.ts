/**
 * Tests for scoring helper functions.
 * 
 * ## Running Tests
 * 
 * From the project root:
 * ```bash
 * cd backend
 * bun test intent_scorer/scoring.test.ts
 * ```
 * 
 * Or from the backend directory:
 * ```bash
 * bun test intent_scorer/scoring.test.ts
 * ```
 * 
 * To run all tests in the intent_scorer directory:
 * ```bash
 * bun test intent_scorer/
 * ```
 * 
 * ## Test Coverage
 * 
 * Tests cover:
 * - parseOccurredAt: unix seconds, ISO strings, invalid input
 * - scoreDelta: all event types, pricing bonuses, threshold conditions
 * - bandFromScore: boundary values (0, 9, 10, 19, 20, 29, 30)
 * - shouldEmitThreshold: first band, upward movement, same band, downward movement
 * - normalizeEventType: valid types, invalid types, error messages
 */

import { describe, it, expect } from "bun:test";
import {
  parseOccurredAt,
  scoreDelta,
  bandFromScore,
  shouldEmitThreshold,
  normalizeEventType,
  type EventType,
  type ThresholdBand,
} from "./scoring";

describe("parseOccurredAt", () => {
  it("should parse unix seconds correctly", () => {
    const unixSeconds = 1700000000; // Jan 15, 2023
    const date = parseOccurredAt(unixSeconds);
    expect(date.getTime()).toBe(unixSeconds * 1000);
  });

  it("should parse ISO string correctly", () => {
    const isoString = "2023-01-15T00:00:00.000Z";
    const date = parseOccurredAt(isoString);
    expect(date.toISOString()).toBe(isoString);
  });

  it("should throw error for invalid ISO string", () => {
    expect(() => parseOccurredAt("invalid-date")).toThrow(
      "Invalid timestamp format"
    );
  });

  it("should handle unix timestamp 0", () => {
    const date = parseOccurredAt(0);
    expect(date.getTime()).toBe(0);
  });
});

describe("scoreDelta", () => {
  describe("page_view", () => {
    it("should return +1 for regular page_view", () => {
      expect(scoreDelta("page_view", "/home")).toBe(1);
    });

    it("should return +5 for page_view on pricing page", () => {
      expect(scoreDelta("page_view", "/pricing")).toBe(5); // 1 + 4 bonus
    });

    it("should return +5 for page_view with pricing in path", () => {
      expect(scoreDelta("page_view", "/products/pricing")).toBe(5);
    });
  });

  describe("time_on_page", () => {
    it("should return 0 if value <= 30", () => {
      expect(scoreDelta("time_on_page", "/home", 30)).toBe(0);
      expect(scoreDelta("time_on_page", "/home", 29)).toBe(0);
      expect(scoreDelta("time_on_page", "/home", 0)).toBe(0);
    });

    it("should return +2 if value > 30", () => {
      expect(scoreDelta("time_on_page", "/home", 31)).toBe(2);
      expect(scoreDelta("time_on_page", "/home", 60)).toBe(2);
    });

    it("should return 0 if value is undefined", () => {
      expect(scoreDelta("time_on_page", "/home")).toBe(0);
    });
  });

  describe("scroll_depth", () => {
    it("should return 0 if value <= 60", () => {
      expect(scoreDelta("scroll_depth", "/home", 60)).toBe(0);
      expect(scoreDelta("scroll_depth", "/home", 59)).toBe(0);
      expect(scoreDelta("scroll_depth", "/home", 0)).toBe(0);
    });

    it("should return +2 if value > 60", () => {
      expect(scoreDelta("scroll_depth", "/home", 61)).toBe(2);
      expect(scoreDelta("scroll_depth", "/home", 100)).toBe(2);
    });

    it("should return 0 if value is undefined", () => {
      expect(scoreDelta("scroll_depth", "/home")).toBe(0);
    });
  });

  describe("click", () => {
    it("should return +3 for regular click", () => {
      expect(scoreDelta("click", "/home")).toBe(3);
    });

    it("should return +7 for click on pricing page", () => {
      expect(scoreDelta("click", "/pricing")).toBe(7); // 3 + 4 bonus
    });

    it("should return +7 for click with pricing in path", () => {
      expect(scoreDelta("click", "/products/pricing")).toBe(7);
    });
  });

  describe("form_start", () => {
    it("should return +6", () => {
      expect(scoreDelta("form_start", "/contact")).toBe(6);
      expect(scoreDelta("form_start", "/pricing")).toBe(6); // No pricing bonus for form_start
    });
  });

  describe("form_submit", () => {
    it("should return +10", () => {
      expect(scoreDelta("form_submit", "/contact")).toBe(10);
      expect(scoreDelta("form_submit", "/pricing")).toBe(10); // No pricing bonus for form_submit
    });
  });
});

describe("bandFromScore", () => {
  it("should return 'cold' for scores 0-9", () => {
    expect(bandFromScore(0)).toBe("cold");
    expect(bandFromScore(5)).toBe("cold");
    expect(bandFromScore(9)).toBe("cold");
  });

  it("should return 'warm' for scores 10-19", () => {
    expect(bandFromScore(10)).toBe("warm");
    expect(bandFromScore(15)).toBe("warm");
    expect(bandFromScore(19)).toBe("warm");
  });

  it("should return 'hot' for scores 20-29", () => {
    expect(bandFromScore(20)).toBe("hot");
    expect(bandFromScore(25)).toBe("hot");
    expect(bandFromScore(29)).toBe("hot");
  });

  it("should return 'critical' for scores 30+", () => {
    expect(bandFromScore(30)).toBe("critical");
    expect(bandFromScore(35)).toBe("critical");
    expect(bandFromScore(100)).toBe("critical");
  });
});

describe("shouldEmitThreshold", () => {
  it("should return true for first band (null -> any band)", () => {
    expect(shouldEmitThreshold(null, "cold")).toBe(true);
    expect(shouldEmitThreshold(null, "warm")).toBe(true);
    expect(shouldEmitThreshold(null, "hot")).toBe(true);
    expect(shouldEmitThreshold(null, "critical")).toBe(true);
  });

  it("should return true for upward movement (cold -> warm)", () => {
    expect(shouldEmitThreshold("cold", "warm")).toBe(true);
  });

  it("should return true for upward movement (warm -> hot)", () => {
    expect(shouldEmitThreshold("warm", "hot")).toBe(true);
  });

  it("should return true for upward movement (hot -> critical)", () => {
    expect(shouldEmitThreshold("hot", "critical")).toBe(true);
  });

  it("should return true for upward movement (cold -> hot)", () => {
    expect(shouldEmitThreshold("cold", "hot")).toBe(true);
  });

  it("should return true for upward movement (cold -> critical)", () => {
    expect(shouldEmitThreshold("cold", "critical")).toBe(true);
  });

  it("should return false for same band (warm -> warm)", () => {
    expect(shouldEmitThreshold("warm", "warm")).toBe(false);
  });

  it("should return false for same band (hot -> hot)", () => {
    expect(shouldEmitThreshold("hot", "hot")).toBe(false);
  });

  it("should return false for downward movement (hot -> warm)", () => {
    expect(shouldEmitThreshold("hot", "warm")).toBe(false);
  });

  it("should return false for downward movement (warm -> cold)", () => {
    expect(shouldEmitThreshold("warm", "cold")).toBe(false);
  });

  it("should return false for downward movement (critical -> hot)", () => {
    expect(shouldEmitThreshold("critical", "hot")).toBe(false);
  });
});

describe("normalizeEventType", () => {
  it("should return valid event type for allowed types", () => {
    expect(normalizeEventType("page_view")).toBe("page_view");
    expect(normalizeEventType("time_on_page")).toBe("time_on_page");
    expect(normalizeEventType("scroll_depth")).toBe("scroll_depth");
    expect(normalizeEventType("click")).toBe("click");
    expect(normalizeEventType("form_start")).toBe("form_start");
    expect(normalizeEventType("form_submit")).toBe("form_submit");
  });

  it("should throw error for invalid event type", () => {
    expect(() => normalizeEventType("invalid_event")).toThrow(
      "Invalid event type"
    );
    expect(() => normalizeEventType("")).toThrow("Invalid event type");
    expect(() => normalizeEventType("pageview")).toThrow("Invalid event type");
  });

  it("should include allowed types in error message", () => {
    try {
      normalizeEventType("invalid");
      expect(true).toBe(false); // Should not reach here
    } catch (e: any) {
      expect(e.message).toContain("page_view");
      expect(e.message).toContain("form_submit");
    }
  });
});

