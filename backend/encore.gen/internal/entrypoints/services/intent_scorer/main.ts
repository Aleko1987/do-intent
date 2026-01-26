import { registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";
import { Worker, isMainThread } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { availableParallelism } from "node:os";

import { computeEventScore as computeEventScoreImpl0 } from "../../../../../intent_scorer\\compute_score";
import { getLeadTopSignals as getLeadTopSignalsImpl1 } from "../../../../../intent_scorer\\get_lead_top_signals";
import { getLeadTrend as getLeadTrendImpl2 } from "../../../../../intent_scorer\\get_lead_trend";
import { health as healthImpl3 } from "../../../../../intent_scorer\\health";
import { ready as readyImpl4 } from "../../../../../intent_scorer\\health";
import { readyV1 as readyV1Impl5 } from "../../../../../intent_scorer\\health";
import { identify as identifyImpl6 } from "../../../../../intent_scorer\\identify";
import { listEvents as listEventsImpl7 } from "../../../../../intent_scorer\\list_events";
import { listLeadRollups as listLeadRollupsImpl8 } from "../../../../../intent_scorer\\list_lead_rollups";
import { listLeadsIntent as listLeadsIntentImpl9 } from "../../../../../intent_scorer\\list_leads_intent";
import { listRules as listRulesImpl10 } from "../../../../../intent_scorer\\list_rules";
import { ping as pingImpl11 } from "../../../../../intent_scorer\\ping";
import { recomputeScores as recomputeScoresImpl12 } from "../../../../../intent_scorer\\recompute_scores";
import { seedDemo as seedDemoImpl13 } from "../../../../../intent_scorer\\seed_demo";
import { track as trackImpl14 } from "../../../../../intent_scorer\\track";
import { trackOptions as trackOptionsImpl15 } from "../../../../../intent_scorer\\track";
import { trackGet as trackGetImpl16 } from "../../../../../intent_scorer\\track";
import { trackV1 as trackV1Impl17 } from "../../../../../intent_scorer\\track";
import { trackV1Options as trackV1OptionsImpl18 } from "../../../../../intent_scorer\\track";
import { updateRule as updateRuleImpl19 } from "../../../../../intent_scorer\\update_rule";
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
            name:              "ready",
            handler:           readyImpl4,
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
            handler:           readyV1Impl5,
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
            handler:           identifyImpl6,
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
            handler:           listEventsImpl7,
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
            handler:           listLeadRollupsImpl8,
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
            handler:           listLeadsIntentImpl9,
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
            handler:           listRulesImpl10,
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
            handler:           pingImpl11,
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
            handler:           recomputeScoresImpl12,
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
            handler:           seedDemoImpl13,
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
            handler:           trackImpl14,
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
            handler:           trackOptionsImpl15,
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
            handler:           trackGetImpl16,
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
            handler:           trackV1Impl17,
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
            handler:           trackV1OptionsImpl18,
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
            handler:           updateRuleImpl19,
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
