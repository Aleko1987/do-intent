import { apiCall, streamIn, streamOut, streamInOut } from "encore.dev/internal/codegen/api";
import { registerTestHandler } from "encore.dev/internal/codegen/appinit";

import * as marketing_service from "../../../../marketing\\encore.service";

export async function createEvent(params, opts) {
    const handler = (await import("../../../../marketing\\create_event")).createEvent;
    registerTestHandler({
        apiRoute: { service: "marketing", name: "createEvent", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: marketing_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("marketing", "createEvent", params, opts);
}

export async function create(params, opts) {
    const handler = (await import("../../../../marketing\\create_lead")).create;
    registerTestHandler({
        apiRoute: { service: "marketing", name: "create", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: marketing_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("marketing", "create", params, opts);
}

export async function getWithEvents(params, opts) {
    const handler = (await import("../../../../marketing\\get_lead_events")).getWithEvents;
    registerTestHandler({
        apiRoute: { service: "marketing", name: "getWithEvents", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: marketing_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("marketing", "getWithEvents", params, opts);
}

export async function identify(params, opts) {
    const handler = (await import("../../../../marketing\\identify")).identify;
    registerTestHandler({
        apiRoute: { service: "marketing", name: "identify", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: marketing_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("marketing", "identify", params, opts);
}

export async function ingestIntentEvent(params, opts) {
    const handler = (await import("../../../../marketing\\ingest_intent_event")).ingestIntentEvent;
    registerTestHandler({
        apiRoute: { service: "marketing", name: "ingestIntentEvent", raw: true, handler, streamingRequest: false, streamingResponse: false },
        middlewares: marketing_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":true,"isStream":false,"tags":[]},
    });

    return apiCall("marketing", "ingestIntentEvent", params, opts);
}

export async function ingestIntentEventV1(params, opts) {
    const handler = (await import("../../../../marketing\\ingest_intent_event")).ingestIntentEventV1;
    registerTestHandler({
        apiRoute: { service: "marketing", name: "ingestIntentEventV1", raw: true, handler, streamingRequest: false, streamingResponse: false },
        middlewares: marketing_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":true,"isStream":false,"tags":[]},
    });

    return apiCall("marketing", "ingestIntentEventV1", params, opts);
}

export async function ingestIntentEventOptions(params, opts) {
    const handler = (await import("../../../../marketing\\ingest_intent_event")).ingestIntentEventOptions;
    registerTestHandler({
        apiRoute: { service: "marketing", name: "ingestIntentEventOptions", raw: true, handler, streamingRequest: false, streamingResponse: false },
        middlewares: marketing_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":true,"isStream":false,"tags":[]},
    });

    return apiCall("marketing", "ingestIntentEventOptions", params, opts);
}

export async function ingestIntentEventV1Options(params, opts) {
    const handler = (await import("../../../../marketing\\ingest_intent_event")).ingestIntentEventV1Options;
    registerTestHandler({
        apiRoute: { service: "marketing", name: "ingestIntentEventV1Options", raw: true, handler, streamingRequest: false, streamingResponse: false },
        middlewares: marketing_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":true,"isStream":false,"tags":[]},
    });

    return apiCall("marketing", "ingestIntentEventV1Options", params, opts);
}

export async function list(params, opts) {
    const handler = (await import("../../../../marketing\\list_leads")).list;
    registerTestHandler({
        apiRoute: { service: "marketing", name: "list", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: marketing_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("marketing", "list", params, opts);
}

export async function update(params, opts) {
    const handler = (await import("../../../../marketing\\update_lead")).update;
    registerTestHandler({
        apiRoute: { service: "marketing", name: "update", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: marketing_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("marketing", "update", params, opts);
}

export async function webhookEvent(params, opts) {
    const handler = (await import("../../../../marketing\\webhook_event")).webhookEvent;
    registerTestHandler({
        apiRoute: { service: "marketing", name: "webhookEvent", raw: false, handler, streamingRequest: false, streamingResponse: false },
        middlewares: marketing_service.default.cfg.middlewares || [],
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
    });

    return apiCall("marketing", "webhookEvent", params, opts);
}

