CREATE TABLE IF NOT EXISTS owner_contact_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('csv_upload', 'paste_text', 'api_refresh')),
  mode TEXT NOT NULL CHECK (mode IN ('full_refresh', 'delta')),
  input_format TEXT NOT NULL CHECK (input_format IN ('csv', 'text')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  accepted_rows INTEGER NOT NULL DEFAULT 0,
  rejected_rows INTEGER NOT NULL DEFAULT 0,
  parse_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  actor_user_id TEXT NOT NULL,
  correlation_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_contact_import_batches_owner_created
  ON owner_contact_import_batches (owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS owner_contact_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('csv_upload', 'paste_text', 'api_refresh')),
  external_ref TEXT NULL,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  handles JSONB NOT NULL DEFAULT '[]'::jsonb,
  emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  phones JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_hint NUMERIC(4,3) NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source_updated_at TIMESTAMPTZ NULL,
  import_batch_id UUID NULL REFERENCES owner_contact_import_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_contact_directory_owner_name
  ON owner_contact_directory (owner_user_id, normalized_name);

CREATE INDEX IF NOT EXISTS idx_owner_contact_directory_owner_active
  ON owner_contact_directory (owner_user_id, is_active, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_contact_directory_owner_source_external_ref
  ON owner_contact_directory (owner_user_id, source, external_ref)
  WHERE external_ref IS NOT NULL;
