-- DO-Intent: Real-time Intent Tracking Schema
-- 
-- This migration creates the core tables for anonymous-first, real-time intent scoring:
-- - sessions: Tracks browsing sessions (anonymous by default)
-- - events: Immutable raw interaction events
-- - identities: Known users/entities
-- - intent_scores: Incremental score state with threshold tracking
--
-- Design Principles:
-- 1. Anonymous-first: Events start anonymous, can be promoted to identity later
-- 2. Immutable events: Events are append-only, never updated or deleted
-- 3. Incremental scoring: Scores are updated incrementally, not recomputed
-- 4. Threshold emissions: Tracks last emitted threshold to prevent duplicate signals
-- 5. Identity promotion: Supports merging anonymous history into known identities

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================
-- Represents a browsing session. Sessions are anonymous by default but can
-- be linked to an identity later when the user is identified.
CREATE TABLE sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id UUID NOT NULL,
  identity_id UUID NULL, -- Optional link; may be set later during identity promotion
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT NULL,
  device TEXT NULL,
  country TEXT NULL,
  ip TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Index for looking up sessions by anonymous_id (most common query)
CREATE INDEX idx_sessions_anonymous_id_last_seen ON sessions (anonymous_id, last_seen_at DESC);

-- Index for looking up sessions by identity_id (after promotion)
CREATE INDEX idx_sessions_identity_id ON sessions (identity_id) WHERE identity_id IS NOT NULL;

-- ============================================================================
-- IDENTITIES TABLE
-- ============================================================================
-- Represents a known person or entity. Created when user provides email/identity.
-- Supports merging anonymous browsing history into a known identity.
CREATE TABLE identities (
  identity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NULL,
  source TEXT NULL, -- e.g., 'website', 'socials', etc.
  first_identified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Index for looking up identities by last_seen_at (for recency queries)
CREATE INDEX idx_identities_last_seen ON identities (last_seen_at DESC);

-- ============================================================================
-- EVENTS TABLE
-- ============================================================================
-- Immutable raw interaction events. Events are never updated or deleted.
-- Supports anonymous-first tracking with optional identity_id that can be
-- backfilled later when anonymous_id is promoted to identity.
CREATE TABLE events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  anonymous_id UUID NOT NULL,
  identity_id UUID NULL REFERENCES identities(identity_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- e.g., 'page_view', 'click', 'form_submit', etc.
  event_value NUMERIC NULL, -- Optional numeric value (e.g., scroll_depth percentage)
  url TEXT NOT NULL,
  referrer TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL, -- When the event actually happened (client-side)
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- When we received it (server-side)
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes for efficient event lookups:
-- 1. Lookup events by anonymous_id (most common during anonymous browsing)
CREATE INDEX idx_events_anonymous_id_occurred ON events (anonymous_id, occurred_at DESC);

-- 2. Lookup events by identity_id (after identity promotion)
CREATE INDEX idx_events_identity_id_occurred ON events (identity_id, occurred_at DESC) WHERE identity_id IS NOT NULL;

-- 3. Lookup events by session_id (for session-based queries)
CREATE INDEX idx_events_session_id_occurred ON events (session_id, occurred_at DESC);

-- 4. Lookup events by timestamp (for time-based queries)
CREATE INDEX idx_events_occurred_at ON events (occurred_at DESC);

-- ============================================================================
-- INTENT_SCORES TABLE
-- ============================================================================
-- Incremental intent score state. Updated in real-time as events arrive.
-- Tracks the last threshold emitted to prevent duplicate threshold signals.
--
-- How incremental scoring works:
-- - Each event triggers a score delta calculation
-- - total_score is updated incrementally (never recomputed from scratch)
-- - last_event_at tracks the most recent event that contributed to the score
--
-- How threshold emissions work:
-- - After each score update, thresholds are evaluated
-- - last_threshold_emitted stores the highest threshold band already emitted
-- - Prevents duplicate emissions when score crosses same threshold multiple times
--
-- How identity promotion works:
-- - Scores can exist for both 'anonymous' and 'identity' subject types
-- - When anonymous_id is promoted to identity_id, anonymous score is transferred
-- - The intent_scores row is updated or merged accordingly
CREATE TABLE intent_scores (
  intent_score_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('anonymous', 'identity')),
  subject_id UUID NOT NULL, -- References anonymous_id or identity_id depending on subject_type
  total_score INTEGER NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ NULL, -- Most recent event timestamp that contributed to this score
  last_threshold_emitted TEXT NULL CHECK (
    last_threshold_emitted IN ('cold', 'warm', 'hot', 'critical') 
    OR last_threshold_emitted IS NULL
  ), -- Highest threshold band already emitted (prevents duplicate signals)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(subject_type, subject_id)
);

-- Index for efficient score lookups (used in threshold evaluation and score retrieval)
CREATE INDEX idx_intent_scores_subject ON intent_scores (subject_type, subject_id);

-- Index for finding high-intent subjects (for prioritization)
CREATE INDEX idx_intent_scores_total_score ON intent_scores (total_score DESC);

-- Index for finding recently active subjects
CREATE INDEX idx_intent_scores_last_event_at ON intent_scores (last_event_at DESC) WHERE last_event_at IS NOT NULL;

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================
-- Add foreign key from sessions to identities
-- Note: This FK allows NULL since sessions.identity_id can be NULL initially
-- and set later during identity promotion.
ALTER TABLE sessions ADD CONSTRAINT fk_sessions_identity_id 
  FOREIGN KEY (identity_id) REFERENCES identities(identity_id) ON DELETE SET NULL;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE sessions IS 'Tracks browsing sessions. Anonymous by default, can be linked to identity later.';
COMMENT ON TABLE events IS 'Immutable raw interaction events. Append-only, never updated or deleted. Supports anonymous-first tracking with optional identity backfill.';
COMMENT ON TABLE identities IS 'Known users/entities. Created when email/identity is provided. Supports merging anonymous history.';
COMMENT ON TABLE intent_scores IS 'Incremental intent score state. Updated in real-time. Tracks last threshold emitted to prevent duplicate signals.';

COMMENT ON COLUMN events.identity_id IS 'Nullable to support anonymous-first tracking. Can be backfilled when anonymous_id is promoted to identity_id.';
COMMENT ON COLUMN intent_scores.subject_type IS 'Either "anonymous" or "identity". Determines whether subject_id refers to anonymous_id or identity_id.';
COMMENT ON COLUMN intent_scores.last_threshold_emitted IS 'Highest threshold band already emitted. Prevents duplicate threshold signals when score crosses same band multiple times.';

