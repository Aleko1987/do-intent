/**
 * Scoring helper module for DO-Intent.
 * Contains deterministic scoring logic extracted from track.ts for testability.
 */

// Allowed event types from ARCHITECTURE.md
export const ALLOWED_EVENT_TYPES = [
  "page_view",
  "time_on_page",
  "scroll_depth",
  "click",
  "form_start",
  "form_submit",
] as const;

export type EventType = "page_view" | "scroll_depth" | "time_on_page" | "click" | "form_start" | "form_submit";
export type ThresholdBand = "cold" | "warm" | "hot" | "critical";

/**
 * Parses timestamp from unix seconds or ISO string to Date.
 * @param input - Unix seconds (number) or ISO string
 * @returns Date object
 * @throws Error if input is invalid
 */
export function parseOccurredAt(input: number | string): Date {
  if (typeof input === "number") {
    // Unix seconds
    return new Date(input * 1000);
  }
  // ISO string
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid timestamp format");
  }
  return date;
}

/**
 * Calculates score delta based on event type, URL, and optional value.
 * Scoring rules from ARCHITECTURE.md:
 * - page_view: +1 base (+4 bonus if URL contains '/pricing')
 * - time_on_page: +2 if value > 30 seconds
 * - scroll_depth: +2 if value > 60 (0-100)
 * - click: +3 base (+4 bonus if URL contains '/pricing')
 * - form_start: +6
 * - form_submit: +10
 *
 * @param eventType - The event type
 * @param url - The URL where the event occurred
 * @param value - Optional numeric value (seconds for time_on_page, 0-100 for scroll_depth)
 * @returns Integer score delta
 */
export function scoreDelta(
  eventType: EventType,
  url: string,
  value?: number
): number {
  let delta = 0;

  switch (eventType) {
    case "page_view":
      delta = 1;
      // Check for pricing_view bonus
      if (url.includes("/pricing")) {
        delta += 4;
      }
      break;

    case "time_on_page":
      // value is assumed to be seconds
      if (value !== undefined && value > 30) {
        delta = 2;
      }
      break;

    case "scroll_depth":
      // value is 0-100 percentage
      if (value !== undefined && value > 60) {
        delta = 2;
      }
      break;

    case "click":
      delta = 3;
      // Check for pricing_view bonus
      if (url.includes("/pricing")) {
        delta += 4;
      }
      break;

    case "form_start":
      delta = 6;
      break;

    case "form_submit":
      delta = 10;
      break;

    default:
      delta = 0;
  }

  return delta;
}

/**
 * Determines the threshold band from a score.
 * Bands: 0-9 cold, 10-19 warm, 20-29 hot, 30+ critical
 *
 * @param totalScore - The total intent score
 * @returns Threshold band
 */
export function bandFromScore(totalScore: number): ThresholdBand {
  if (totalScore >= 30) return "critical";
  if (totalScore >= 20) return "hot";
  if (totalScore >= 10) return "warm";
  return "cold";
}

/**
 * Determines if a threshold should be emitted based on previous and new bands.
 * Rules:
 * - Emit on first band (prevBand is null)
 * - Emit on upward movement (newBand > prevBand)
 * - Do NOT emit on downward movement or same band (v1)
 *
 * @param prevBand - Previous threshold band (null if first time)
 * @param newBand - New threshold band
 * @returns true if threshold should be emitted
 */
export function shouldEmitThreshold(
  prevBand: ThresholdBand | null,
  newBand: ThresholdBand
): boolean {
  if (prevBand === null) {
    // First threshold emission
    return true;
  }

  // Check if band changed upward
  const bandOrder: ThresholdBand[] = ["cold", "warm", "hot", "critical"];
  const currentBandIndex = bandOrder.indexOf(newBand);
  const lastBandIndex = bandOrder.indexOf(prevBand);

  // Only emit on upward movement
  return currentBandIndex > lastBandIndex;
}

/**
 * Normalizes and validates event type.
 * @param input - Event type string to validate
 * @returns Validated EventType
 * @throws Error if event type is not allowed
 */
export function normalizeEventType(input: string): EventType {
  if (!ALLOWED_EVENT_TYPES.includes(input as EventType)) {
    throw new Error(
      `Invalid event type: ${input}. Must be one of: ${ALLOWED_EVENT_TYPES.join(", ")}`
    );
  }
  return input as EventType;
}

