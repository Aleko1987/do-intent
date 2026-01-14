import { apiCall, streamIn, streamOut, streamInOut } from "encore.dev/internal/codegen/api";
import { registerTestHandler } from "encore.dev/internal/codegen/appinit";

import * as intent_scorer_service from "../../../../intent_scorer\\encore.service";

export async function computeEventScore(params, opts) {
    const handler = (await import("../../../../intent_scorer\\compute_score")).computeEventScore;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "computeEventScore", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "computeEventScore", params, opts);
}

export async function getLeadTopSignals(params, opts) {
    const handler = (await import("../../../../intent_scorer\\get_lead_top_signals")).getLeadTopSignals;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "getLeadTopSignals", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "getLeadTopSignals", params, opts);
}

export async function getLeadTrend(params, opts) {
    const handler = (await import("../../../../intent_scorer\\get_lead_trend")).getLeadTrend;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "getLeadTrend", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "getLeadTrend", params, opts);
}

export async function health(params, opts) {
    const handler = (await import("../../../../intent_scorer\\health")).health;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "health", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "health", params, opts);
}

export async function identify(params, opts) {
    const handler = (await import("../../../../intent_scorer\\identify")).identify;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "identify", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "identify", params, opts);
}

export async function listEvents(params, opts) {
    const handler = (await import("../../../../intent_scorer\\list_events")).listEvents;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "listEvents", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "listEvents", params, opts);
}

export async function listLeadRollups(params, opts) {
    const handler = (await import("../../../../intent_scorer\\list_lead_rollups")).listLeadRollups;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "listLeadRollups", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "listLeadRollups", params, opts);
}

export async function listLeadsIntent(params, opts) {
    const handler = (await import("../../../../intent_scorer\\list_leads_intent")).listLeadsIntent;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "listLeadsIntent", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "listLeadsIntent", params, opts);
}

export async function listRules(params, opts) {
    const handler = (await import("../../../../intent_scorer\\list_rules")).listRules;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "listRules", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "listRules", params, opts);
}

export async function ping(params, opts) {
    const handler = (await import("../../../../intent_scorer\\ping")).ping;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "ping", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "ping", params, opts);
}

export async function recomputeScores(params, opts) {
    const handler = (await import("../../../../intent_scorer\\recompute_scores")).recomputeScores;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "recomputeScores", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "recomputeScores", params, opts);
}

export async function seedDemo(params, opts) {
    const handler = (await import("../../../../intent_scorer\\seed_demo")).seedDemo;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "seedDemo", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "seedDemo", params, opts);
}

export async function track(params, opts) {
    const handler = (await import("../../../../intent_scorer\\track")).track;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "track", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "track", params, opts);
}

export async function updateRule(params, opts) {
    const handler = (await import("../../../../intent_scorer\\update_rule")).updateRule;
    registerTestHandler({
        apiRoute: { service: "intent_scorer", name: "updateRule", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("intent_scorer", "updateRule", params, opts);
}

