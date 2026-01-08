import { apiCall, streamIn, streamOut, streamInOut } from "encore.dev/internal/codegen/api";

const TEST_ENDPOINTS = typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test"
    ? await import("./endpoints_testing.js")
    : null;

export async function createEvent(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.createEvent(params, opts);
    }

    return apiCall("marketing", "createEvent", params, opts);
}
export async function create(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.create(params, opts);
    }

    return apiCall("marketing", "create", params, opts);
}
export async function getWithEvents(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.getWithEvents(params, opts);
    }

    return apiCall("marketing", "getWithEvents", params, opts);
}
export async function identify(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.identify(params, opts);
    }

    return apiCall("marketing", "identify", params, opts);
}
export async function ingestIntentEvent(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.ingestIntentEvent(params, opts);
    }

    return apiCall("marketing", "ingestIntentEvent", params, opts);
}
export async function list(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.list(params, opts);
    }

    return apiCall("marketing", "list", params, opts);
}
export async function update(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.update(params, opts);
    }

    return apiCall("marketing", "update", params, opts);
}
export async function webhookEvent(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.webhookEvent(params, opts);
    }

    return apiCall("marketing", "webhookEvent", params, opts);
}
