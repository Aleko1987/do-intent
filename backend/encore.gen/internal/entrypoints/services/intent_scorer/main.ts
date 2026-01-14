import { registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";
import { Worker, isMainThread } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { availableParallelism } from "node:os";

import { computeEventScore as computeEventScoreImpl0 } from "../../../../../intent_scorer\\compute_score";
import { getLeadTopSignals as getLeadTopSignalsImpl1 } from "../../../../../intent_scorer\\get_lead_top_signals";
import { getLeadTrend as getLeadTrendImpl2 } from "../../../../../intent_scorer\\get_lead_trend";
import { health as healthImpl3 } from "../../../../../intent_scorer\\health";
import { identify as identifyImpl4 } from "../../../../../intent_scorer\\identify";
import { listEvents as listEventsImpl5 } from "../../../../../intent_scorer\\list_events";
import { listLeadRollups as listLeadRollupsImpl6 } from "../../../../../intent_scorer\\list_lead_rollups";
import { listLeadsIntent as listLeadsIntentImpl7 } from "../../../../../intent_scorer\\list_leads_intent";
import { listRules as listRulesImpl8 } from "../../../../../intent_scorer\\list_rules";
import { ping as pingImpl9 } from "../../../../../intent_scorer\\ping";
import { recomputeScores as recomputeScoresImpl10 } from "../../../../../intent_scorer\\recompute_scores";
import { seedDemo as seedDemoImpl11 } from "../../../../../intent_scorer\\seed_demo";
import { track as trackImpl12 } from "../../../../../intent_scorer\\track";
import { updateRule as updateRuleImpl13 } from "../../../../../intent_scorer\\update_rule";
import * as intent_scorer_service from "../../../../../intent_scorer\\encore.service";

const handlers: Handler[] = [
    {
        apiRoute: {
            service:           "intent_scorer",
            name:              "computeEventScore",
            handler:           computeEventScoreImpl0,
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
            handler:           getLeadTopSignalsImpl1,
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
            handler:           getLeadTrendImpl2,
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
            handler:           healthImpl3,
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
            handler:           identifyImpl4,
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
            handler:           listEventsImpl5,
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
            handler:           listLeadRollupsImpl6,
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
            handler:           listLeadsIntentImpl7,
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
            handler:           listRulesImpl8,
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
            handler:           pingImpl9,
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
            handler:           recomputeScoresImpl10,
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
            handler:           seedDemoImpl11,
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
            handler:           trackImpl12,
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
            handler:           updateRuleImpl13,
            raw:               false,
            streamingRequest:  false,
            streamingResponse: false,
        },
        endpointOptions: {"expose":true,"auth":false,"isRaw":false,"isStream":false,"tags":[]},
        middlewares: intent_scorer_service.default.cfg.middlewares || [],
    },
];

registerHandlers(handlers);

await run(import.meta.url);
