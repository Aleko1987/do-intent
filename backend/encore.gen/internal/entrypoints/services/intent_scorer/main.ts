import { registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";
import { Worker, isMainThread } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { availableParallelism } from "node:os";

import { computeEventScore as computeEventScoreImpl0 } from "../../../../../intent_scorer\\compute_score";
import { getLeadTopSignals as getLeadTopSignalsImpl1 } from "../../../../../intent_scorer\\get_lead_top_signals";
import { getLeadTrend as getLeadTrendImpl2 } from "../../../../../intent_scorer\\get_lead_trend";
import { listEvents as listEventsImpl3 } from "../../../../../intent_scorer\\list_events";
import { listLeadRollups as listLeadRollupsImpl4 } from "../../../../../intent_scorer\\list_lead_rollups";
import { listLeadsIntent as listLeadsIntentImpl5 } from "../../../../../intent_scorer\\list_leads_intent";
import { listRules as listRulesImpl6 } from "../../../../../intent_scorer\\list_rules";
import { recomputeScores as recomputeScoresImpl7 } from "../../../../../intent_scorer\\recompute_scores";
import { seedDemo as seedDemoImpl8 } from "../../../../../intent_scorer\\seed_demo";
import { updateRule as updateRuleImpl9 } from "../../../../../intent_scorer\\update_rule";
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
            name:              "listEvents",
            handler:           listEventsImpl3,
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
            handler:           listLeadRollupsImpl4,
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
            handler:           listLeadsIntentImpl5,
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
            handler:           listRulesImpl6,
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
            handler:           recomputeScoresImpl7,
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
            handler:           seedDemoImpl8,
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
            handler:           updateRuleImpl9,
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
