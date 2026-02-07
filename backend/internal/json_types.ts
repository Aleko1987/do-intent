export type JsonPrimitive = string | number | boolean | null;

// Flat JSON object (no nested objects/arrays) to keep Encore schema generation stable.
export type JsonObject = Record<string, JsonPrimitive>;

