const ATTRIBUTION_STORAGE_KEY = "doi_attribution_context_v1";

const ATTRIBUTION_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
  "fbclid",
  "gclid",
  "wbraid",
  "gbraid",
  "ttclid",
  "li_fat_id",
  "msclkid",
  "twclid",
] as const;

type AttributionQueryKey = (typeof ATTRIBUTION_QUERY_KEYS)[number];

type AttributionValue = string | undefined;

export type AttributionContext = Partial<
  Record<
    | "first_touch_at"
    | "first_touch_url"
    | "first_referrer"
    | "last_touch_at"
    | "last_touch_url"
    | "last_referrer"
    | `ft_${AttributionQueryKey}`
    | `lt_${AttributionQueryKey}`,
    string
  >
>;

function safeReadStorage(): AttributionContext {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as AttributionContext;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function safeWriteStorage(context: AttributionContext): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Non-fatal: tracking should not break the page.
  }
}

function readCurrentAttributionFromUrl(): Partial<Record<AttributionQueryKey, AttributionValue>> {
  if (typeof window === "undefined") {
    return {};
  }
  const params = new URLSearchParams(window.location.search);
  const values: Partial<Record<AttributionQueryKey, AttributionValue>> = {};
  for (const key of ATTRIBUTION_QUERY_KEYS) {
    const value = params.get(key);
    if (value) {
      values[key] = value;
    }
  }
  return values;
}

function hasAnyAttributionParam(values: Partial<Record<AttributionQueryKey, AttributionValue>>): boolean {
  return ATTRIBUTION_QUERY_KEYS.some((key) => Boolean(values[key]));
}

function withPrefixedFields(
  values: Partial<Record<AttributionQueryKey, AttributionValue>>,
  prefix: "ft" | "lt"
): AttributionContext {
  const out: AttributionContext = {};
  for (const key of ATTRIBUTION_QUERY_KEYS) {
    const value = values[key];
    if (value) {
      out[`${prefix}_${key}`] = value;
    }
  }
  return out;
}

export function captureAttributionContextOnLanding(): AttributionContext {
  const existing = safeReadStorage();
  const currentValues = readCurrentAttributionFromUrl();
  if (!hasAnyAttributionParam(currentValues) || typeof window === "undefined") {
    return existing;
  }

  const now = new Date().toISOString();
  const next: AttributionContext = { ...existing };

  if (!next.first_touch_at) {
    next.first_touch_at = now;
    next.first_touch_url = window.location.href;
    next.first_referrer = document.referrer || undefined;
    Object.assign(next, withPrefixedFields(currentValues, "ft"));
  }

  next.last_touch_at = now;
  next.last_touch_url = window.location.href;
  next.last_referrer = document.referrer || undefined;
  Object.assign(next, withPrefixedFields(currentValues, "lt"));

  safeWriteStorage(next);
  return next;
}

export function getAttributionContext(): AttributionContext {
  return safeReadStorage();
}

