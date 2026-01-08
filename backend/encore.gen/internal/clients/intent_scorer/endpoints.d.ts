import { CallOpts } from "encore.dev/api";

type Parameters<T> = T extends (...args: infer P) => unknown ? P : never;
type WithCallOpts<T extends (...args: any) => any> = (
  ...args: [...Parameters<T>, opts?: CallOpts]
) => ReturnType<T>;

import { computeEventScore as computeEventScore_handler } from "../../../../intent_scorer\\compute_score.js";
declare const computeEventScore: WithCallOpts<typeof computeEventScore_handler>;
export { computeEventScore };

import { getLeadTopSignals as getLeadTopSignals_handler } from "../../../../intent_scorer\\get_lead_top_signals.js";
declare const getLeadTopSignals: WithCallOpts<typeof getLeadTopSignals_handler>;
export { getLeadTopSignals };

import { getLeadTrend as getLeadTrend_handler } from "../../../../intent_scorer\\get_lead_trend.js";
declare const getLeadTrend: WithCallOpts<typeof getLeadTrend_handler>;
export { getLeadTrend };

import { listEvents as listEvents_handler } from "../../../../intent_scorer\\list_events.js";
declare const listEvents: WithCallOpts<typeof listEvents_handler>;
export { listEvents };

import { listLeadRollups as listLeadRollups_handler } from "../../../../intent_scorer\\list_lead_rollups.js";
declare const listLeadRollups: WithCallOpts<typeof listLeadRollups_handler>;
export { listLeadRollups };

import { listLeadsIntent as listLeadsIntent_handler } from "../../../../intent_scorer\\list_leads_intent.js";
declare const listLeadsIntent: WithCallOpts<typeof listLeadsIntent_handler>;
export { listLeadsIntent };

import { listRules as listRules_handler } from "../../../../intent_scorer\\list_rules.js";
declare const listRules: WithCallOpts<typeof listRules_handler>;
export { listRules };

import { recomputeScores as recomputeScores_handler } from "../../../../intent_scorer\\recompute_scores.js";
declare const recomputeScores: WithCallOpts<typeof recomputeScores_handler>;
export { recomputeScores };

import { seedDemo as seedDemo_handler } from "../../../../intent_scorer\\seed_demo.js";
declare const seedDemo: WithCallOpts<typeof seedDemo_handler>;
export { seedDemo };

import { updateRule as updateRule_handler } from "../../../../intent_scorer\\update_rule.js";
declare const updateRule: WithCallOpts<typeof updateRule_handler>;
export { updateRule };


