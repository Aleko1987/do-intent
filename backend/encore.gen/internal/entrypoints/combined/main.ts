import { registerGateways, registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";

import { gw as api_gatewayGW } from "../../../../auth\\auth";
import { create as content_createImpl0 } from "../../../../content\\create_item";
import { deleteItem as content_deleteItemImpl1 } from "../../../../content\\delete_item";
import { list as content_listImpl2 } from "../../../../content\\list_items";
import { logPost as content_logPostImpl3 } from "../../../../content\\log_post";
import { update as content_updateImpl4 } from "../../../../content\\update_item";
import { env as debug_envImpl5 } from "../../../../debug\\env";
import { computeEventScore as intent_scorer_computeEventScoreImpl6 } from "../../../../intent_scorer\\compute_score";
import { getLeadTopSignals as intent_scorer_getLeadTopSignalsImpl7 } from "../../../../intent_scorer\\get_lead_top_signals";
import { getLeadTrend as intent_scorer_getLeadTrendImpl8 } from "../../../../intent_scorer\\get_lead_trend";
import { health as intent_scorer_healthImpl9 } from "../../../../intent_scorer\\health";
import { identify as intent_scorer_identifyImpl10 } from "../../../../intent_scorer\\identify";
import { listEvents as intent_scorer_listEventsImpl11 } from "../../../../intent_scorer\\list_events";
import { listLeadRollups as intent_scorer_listLeadRollupsImpl12 } from "../../../../intent_scorer\\list_lead_rollups";
import { listLeadsIntent as intent_scorer_listLeadsIntentImpl13 } from "../../../../intent_scorer\\list_leads_intent";
import { listRules as intent_scorer_listRulesImpl14 } from "../../../../intent_scorer\\list_rules";
import { ping as intent_scorer_pingImpl15 } from "../../../../intent_scorer\\ping";
import { recomputeScores as intent_scorer_recomputeScoresImpl16 } from "../../../../intent_scorer\\recompute_scores";
import { seedDemo as intent_scorer_seedDemoImpl17 } from "../../../../intent_scorer\\seed_demo";
import { track as intent_scorer_trackImpl18 } from "../../../../intent_scorer\\track";
import { updateRule as intent_scorer_updateRuleImpl19 } from "../../../../intent_scorer\\update_rule";
import { createEvent as marketing_createEventImpl20 } from "../../../../marketing\\create_event";
import { create as marketing_createImpl21 } from "../../../../marketing\\create_lead";
import { getWithEvents as marketing_getWithEventsImpl22 } from "../../../../marketing\\get_lead_events";
import { identify as marketing_identifyImpl23 } from "../../../../marketing\\identify";
import { ingestIntentEvent as marketing_ingestIntentEventImpl24 } from "../../../../marketing\\ingest_intent_event";
import { list as marketing_listImpl25 } from "../../../../marketing\\list_leads";
import { update as marketing_updateImpl26 } from "../../../../marketing\\update_lead";
import { webhookEvent as marketing_webhookEventImpl27 } from "../../../../marketing\\webhook_event";
import * as auth_service from "../../../../auth\\encore.service";
import * as content_service from "../../../../content\\encore.service";
import * as debug_service from "../../../../debug\\encore.service";
import * as intent_scorer_service from "../../../../intent_scorer\\encore.service";
import * as marketing_service from "../../../../marketing\\encore.service";
import * as frontend_service from "../../../../frontend\\encore.service";


const gateways: any[] = [
    api_gatewayGW,
];

const handlers: Handler[] = [
    {
        apiRoute: {
            service:           "content",
            name:              "create",
            handler:           content_createImpl0,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: content_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "content",
            name:              "deleteItem",
            handler:           content_deleteItemImpl1,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: content_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "content",
            name:              "list",
            handler:           content_listImpl2,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: content_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "content",
            name:              "logPost",
            handler:           content_logPostImpl3,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: content_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "content",
            name:              "update",
            handler:           content_updateImpl4,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: content_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "debug",
            name:              "env",
            handler:           debug_envImpl5,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: debug_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "computeEventScore",
            handler:           intent_scorer_computeEventScoreImpl6,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "getLeadTopSignals",
            handler:           intent_scorer_getLeadTopSignalsImpl7,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "getLeadTrend",
            handler:           intent_scorer_getLeadTrendImpl8,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "health",
            handler:           intent_scorer_healthImpl9,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "identify",
            handler:           intent_scorer_identifyImpl10,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "listEvents",
            handler:           intent_scorer_listEventsImpl11,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "listLeadRollups",
            handler:           intent_scorer_listLeadRollupsImpl12,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "listLeadsIntent",
            handler:           intent_scorer_listLeadsIntentImpl13,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":true,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "listRules",
            handler:           intent_scorer_listRulesImpl14,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "ping",
            handler:           intent_scorer_pingImpl15,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "recomputeScores",
            handler:           intent_scorer_recomputeScoresImpl16,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "seedDemo",
            handler:           intent_scorer_seedDemoImpl17,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "track",
            handler:           intent_scorer_trackImpl18,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "updateRule",
            handler:           intent_scorer_updateRuleImpl19,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "marketing",
            name:              "createEvent",
            handler:           marketing_createEventImpl20,
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
            handler:           marketing_createImpl21,
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
            handler:           marketing_getWithEventsImpl22,
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
            handler:           marketing_identifyImpl23,
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
            handler:           marketing_ingestIntentEventImpl24,
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
            handler:           marketing_listImpl25,
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
            handler:           marketing_updateImpl26,
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
            handler:           marketing_webhookEventImpl27,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: marketing_service.default.cfg.middlewares || [],
    },
];

registerGateways(gateways);
registerHandlers(handlers);

await run(import.meta.url);
