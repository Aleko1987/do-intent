import { registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";
import { Worker, isMainThread } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { availableParallelism } from "node:os";

import { createEvent as createEventImpl0 } from "../../../../../marketing\\create_event";
import { create as createImpl1 } from "../../../../../marketing\\create_lead";
import { getWithEvents as getWithEventsImpl2 } from "../../../../../marketing\\get_lead_events";
import { identify as identifyImpl3 } from "../../../../../marketing\\identify";
import { ingestIntentEvent as ingestIntentEventImpl4 } from "../../../../../marketing\\ingest_intent_event";
import { list as listImpl5 } from "../../../../../marketing\\list_leads";
import { update as updateImpl6 } from "../../../../../marketing\\update_lead";
import { webhookEvent as webhookEventImpl7 } from "../../../../../marketing\\webhook_event";
import * as marketing_service from "../../../../../marketing\\encore.service";

const handlers: Handler[] = [
    {
        apiRoute: {
            service:           "marketing",
            name:              "createEvent",
            handler:           createEventImpl0,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: marketing_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "marketing",
            name:              "create",
            handler:           createImpl1,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: marketing_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "marketing",
            name:              "getWithEvents",
            handler:           getWithEventsImpl2,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: marketing_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "marketing",
            name:              "identify",
            handler:           identifyImpl3,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: marketing_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "marketing",
            name:              "ingestIntentEvent",
            handler:           ingestIntentEventImpl4,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: marketing_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "marketing",
            name:              "list",
            handler:           listImpl5,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: marketing_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "marketing",
            name:              "update",
            handler:           updateImpl6,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: marketing_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "marketing",
            name:              "webhookEvent",
            handler:           webhookEventImpl7,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: marketing_service.default.cfg.middlewares || [],
    },
];

registerHandlers(handlers);

await run(import.meta.url);
