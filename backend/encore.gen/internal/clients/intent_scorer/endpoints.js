import { apiCall, streamIn, streamOut, streamInOut } from "encore.dev/internal/codegen/api";

const TEST_ENDPOINTS = typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test"
    ? await import("./endpoints_testing.js")
    : null;

export async function computeEventScore(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.computeEventScore(params, opts);
    }

    return apiCall("intent_scorer", "computeEventScore", params, opts);
}
export async function getLeadTopSignals(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.getLeadTopSignals(params, opts);
    }

    return apiCall("intent_scorer", "getLeadTopSignals", params, opts);
}
export async function getLeadTrend(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.getLeadTrend(params, opts);
    }

    return apiCall("intent_scorer", "getLeadTrend", params, opts);
}
export async function health(opts) {
    const params = undefined;
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.health(params, opts);
    }

    return apiCall("intent_scorer", "health", params, opts);
}
export async function identify(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.identify(params, opts);
    }

    return apiCall("intent_scorer", "identify", params, opts);
}
export async function listEvents(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.listEvents(params, opts);
    }

    return apiCall("intent_scorer", "listEvents", params, opts);
}
export async function listLeadRollups(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.listLeadRollups(params, opts);
    }

    return apiCall("intent_scorer", "listLeadRollups", params, opts);
}
export async function listLeadsIntent(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.listLeadsIntent(params, opts);
    }

    return apiCall("intent_scorer", "listLeadsIntent", params, opts);
}
export async function listRules(opts) {
    const params = undefined;
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.listRules(params, opts);
    }

    return apiCall("intent_scorer", "listRules", params, opts);
}
export async function ping(opts) {
    const params = undefined;
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.ping(params, opts);
    }

    return apiCall("intent_scorer", "ping", params, opts);
}
export async function recomputeScores(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.recomputeScores(params, opts);
    }

    return apiCall("intent_scorer", "recomputeScores", params, opts);
}
export async function seedDemo(opts) {
    const params = undefined;
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.seedDemo(params, opts);
    }

    return apiCall("intent_scorer", "seedDemo", params, opts);
}
export async function track(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.track(params, opts);
    }

    return apiCall("intent_scorer", "track", params, opts);
}
export async function updateRule(params, opts) {
    if (typeof ENCORE_DROP_TESTS === "undefined" && process.env.NODE_ENV === "test") {
        return TEST_ENDPOINTS.updateRule(params, opts);
    }

    return apiCall("intent_scorer", "updateRule", params, opts);
}
