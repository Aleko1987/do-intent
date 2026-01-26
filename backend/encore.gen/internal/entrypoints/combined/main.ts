import { registerGateways, registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";

import { gw as api_gatewayGW } from "../../../../auth\\auth";
import { create as content_createImpl0 } from "../../../../content\\create_item";
import { deleteItem as content_deleteItemImpl1 } from "../../../../content\\delete_item";
import { list as content_listImpl2 } from "../../../../content\\list_items";
import { logPost as content_logPostImpl3 } from "../../../../content\\log_post";
import { update as content_updateImpl4 } from "../../../../content\\update_item";
import { env as debug_envImpl5 } from "../../../../debug\\env";
import { serviceId as debug_serviceIdImpl6 } from "../../../../debug\\service_id";
import { computeEventScore as intent_scorer_computeEventScoreImpl7 } from "../../../../intent_scorer\\compute_score";
import { getLeadTopSignals as intent_scorer_getLeadTopSignalsImpl8 } from "../../../../intent_scorer\\get_lead_top_signals";
import { getLeadTrend as intent_scorer_getLeadTrendImpl9 } from "../../../../intent_scorer\\get_lead_trend";
import { health as intent_scorer_healthImpl10 } from "../../../../intent_scorer\\health";
import { ready as intent_scorer_readyImpl11 } from "../../../../intent_scorer\\health";
import { readyV1 as intent_scorer_readyV1Impl12 } from "../../../../intent_scorer\\health";
import { identify as intent_scorer_identifyImpl13 } from "../../../../intent_scorer\\identify";
import { listEvents as intent_scorer_listEventsImpl14 } from "../../../../intent_scorer\\list_events";
import { listLeadRollups as intent_scorer_listLeadRollupsImpl15 } from "../../../../intent_scorer\\list_lead_rollups";
import { listLeadsIntent as intent_scorer_listLeadsIntentImpl16 } from "../../../../intent_scorer\\list_leads_intent";
import { listRules as intent_scorer_listRulesImpl17 } from "../../../../intent_scorer\\list_rules";
import { ping as intent_scorer_pingImpl18 } from "../../../../intent_scorer\\ping";
import { recomputeScores as intent_scorer_recomputeScoresImpl19 } from "../../../../intent_scorer\\recompute_scores";
import { seedDemo as intent_scorer_seedDemoImpl20 } from "../../../../intent_scorer\\seed_demo";
import { track as intent_scorer_trackImpl21 } from "../../../../intent_scorer\\track";
import { trackOptions as intent_scorer_trackOptionsImpl22 } from "../../../../intent_scorer\\track";
import { trackGet as intent_scorer_trackGetImpl23 } from "../../../../intent_scorer\\track";
import { trackV1 as intent_scorer_trackV1Impl24 } from "../../../../intent_scorer\\track";
import { trackV1Options as intent_scorer_trackV1OptionsImpl25 } from "../../../../intent_scorer\\track";
import { updateRule as intent_scorer_updateRuleImpl26 } from "../../../../intent_scorer\\update_rule";
import { createEvent as marketing_createEventImpl27 } from "../../../../marketing\\create_event";
import { create as marketing_createImpl28 } from "../../../../marketing\\create_lead";
import { getWithEvents as marketing_getWithEventsImpl29 } from "../../../../marketing\\get_lead_events";
import { identify as marketing_identifyImpl30 } from "../../../../marketing\\identify";
import { ingestIntentEvent as marketing_ingestIntentEventImpl31 } from "../../../../marketing\\ingest_intent_event";
import { ingestIntentEventV1 as marketing_ingestIntentEventV1Impl32 } from "../../../../marketing\\ingest_intent_event";
import { ingestIntentEventOptions as marketing_ingestIntentEventOptionsImpl33 } from "../../../../marketing\\ingest_intent_event";
import { ingestIntentEventV1Options as marketing_ingestIntentEventV1OptionsImpl34 } from "../../../../marketing\\ingest_intent_event";
import { list as marketing_listImpl35 } from "../../../../marketing\\list_leads";
import { update as marketing_updateImpl36 } from "../../../../marketing\\update_lead";
import { webhookEvent as marketing_webhookEventImpl37 } from "../../../../marketing\\webhook_event";
import * as auth_service from "../../../../auth\\encore.service";
import * as frontend_service from "../../../../frontend\\encore.service";
import * as debug_service from "../../../../debug\\encore.service";
import * as marketing_service from "../../../../marketing\\encore.service";
import * as intent_scorer_service from "../../../../intent_scorer\\encore.service";
import * as content_service from "../../../../content\\encore.service";


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
            service:           "debug",
            name:              "serviceId",
            handler:           debug_serviceIdImpl6,
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
            handler:           intent_scorer_computeEventScoreImpl7,
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
            handler:           intent_scorer_getLeadTopSignalsImpl8,
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
            handler:           intent_scorer_getLeadTrendImpl9,
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
            handler:           intent_scorer_healthImpl10,
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
            name:              "ready",
            handler:           intent_scorer_readyImpl11,
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
            name:              "readyV1",
            handler:           intent_scorer_readyV1Impl12,
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
            handler:           intent_scorer_identifyImpl13,
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
            handler:           intent_scorer_listEventsImpl14,
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
            handler:           intent_scorer_listLeadRollupsImpl15,
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
            handler:           intent_scorer_listLeadsIntentImpl16,
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
            handler:           intent_scorer_listRulesImpl17,
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
            handler:           intent_scorer_pingImpl18,
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
            handler:           intent_scorer_recomputeScoresImpl19,
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
            handler:           intent_scorer_seedDemoImpl20,
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
            handler:           intent_scorer_trackImpl21,
            raw:               true,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":true,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "trackOptions",
            handler:           intent_scorer_trackOptionsImpl22,
            raw:               true,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":true,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "trackGet",
            handler:           intent_scorer_trackGetImpl23,
            raw:               true,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":true,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "trackV1",
            handler:           intent_scorer_trackV1Impl24,
            raw:               true,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":true,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "trackV1Options",
            handler:           intent_scorer_trackV1OptionsImpl25,
            raw:               true,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":true,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "updateRule",
            handler:           intent_scorer_updateRuleImpl26,
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
            handler:           marketing_createEventImpl27,
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
            handler:           marketing_createImpl28,
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
            handler:           marketing_getWithEventsImpl29,
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
            handler:           marketing_identifyImpl30,
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
            handler:           marketing_ingestIntentEventImpl31,
            raw:               true,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":true,"isStream":false,"tags":[]},
        middlewares: marketing_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "marketing",
            name:              "ingestIntentEventV1",
            handler:           marketing_ingestIntentEventV1Impl32,
            raw:               true,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":true,"isStream":false,"tags":[]},
        middlewares: marketing_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "marketing",
            name:              "ingestIntentEventOptions",
            handler:           marketing_ingestIntentEventOptionsImpl33,
            raw:               true,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":true,"isStream":false,"tags":[]},
        middlewares: marketing_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "marketing",
            name:              "ingestIntentEventV1Options",
            handler:           marketing_ingestIntentEventV1OptionsImpl34,
            raw:               true,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":true,"isStream":false,"tags":[]},
        middlewares: marketing_service.default.cfg.middlewares || [],
    },
    {
        apiRoute: {
            service:           "marketing",
            name:              "list",
            handler:           marketing_listImpl35,
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
            handler:           marketing_updateImpl36,
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
            handler:           marketing_webhookEventImpl37,
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
