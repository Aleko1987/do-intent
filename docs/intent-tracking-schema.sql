-- Minimal intent tracking schema for /track ingestion.
-- Run with: psql "$DATABASE_URL" -f docs/intent-tracking-schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sessions (
  session_id UUID PRIMARY KEY,
  anonymous_id UUID NOT NULL,
  identity_id UUID NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT NULL,
  device TEXT NULL,
  country TEXT NULL,
  ip TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  anonymous_id UUID NOT NULL,
  identity_id UUID NULL,
  event_type TEXT NOT NULL,
  event_value NUMERIC NULL,
  url TEXT NOT NULL,
  referrer TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sessions_anonymous_id_last_seen
ON sessions (anonymous_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_anonymous_id_occurred
ON events (anonymous_id, occurred_at DESC);
