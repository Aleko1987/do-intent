ALTER TABLE owner_contact_import_batches
  ADD COLUMN IF NOT EXISTS owner_scope_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS owner_scope_ref TEXT NULL,
  ADD COLUMN IF NOT EXISTS owner_scope_label TEXT NULL;

ALTER TABLE owner_contact_import_batches
  DROP CONSTRAINT IF EXISTS owner_contact_import_batches_owner_scope_type_check;

ALTER TABLE owner_contact_import_batches
  ADD CONSTRAINT owner_contact_import_batches_owner_scope_type_check
  CHECK (
    owner_scope_type IS NULL OR owner_scope_type IN ('workspace_owner', 'connected_account')
  );

UPDATE owner_contact_import_batches
SET
  owner_scope_type = COALESCE(owner_scope_type, 'workspace_owner'),
  owner_scope_ref = COALESCE(NULLIF(owner_scope_ref, ''), owner_user_id),
  owner_scope_label = COALESCE(NULLIF(owner_scope_label, ''), owner_scope_ref, owner_user_id)
WHERE owner_scope_type IS NULL
  OR owner_scope_ref IS NULL
  OR owner_scope_ref = ''
  OR owner_scope_label IS NULL
  OR owner_scope_label = '';

ALTER TABLE owner_contact_import_batches
  ALTER COLUMN owner_scope_type SET NOT NULL,
  ALTER COLUMN owner_scope_ref SET NOT NULL,
  ALTER COLUMN owner_scope_label SET NOT NULL;

ALTER TABLE owner_contact_directory
  ADD COLUMN IF NOT EXISTS owner_scope_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS owner_scope_ref TEXT NULL,
  ADD COLUMN IF NOT EXISTS owner_scope_label TEXT NULL;

ALTER TABLE owner_contact_directory
  DROP CONSTRAINT IF EXISTS owner_contact_directory_owner_scope_type_check;

ALTER TABLE owner_contact_directory
  ADD CONSTRAINT owner_contact_directory_owner_scope_type_check
  CHECK (owner_scope_type IN ('workspace_owner', 'connected_account'));

UPDATE owner_contact_directory
SET
  owner_scope_type = COALESCE(owner_scope_type, 'workspace_owner'),
  owner_scope_ref = COALESCE(NULLIF(owner_scope_ref, ''), owner_user_id),
  owner_scope_label = COALESCE(NULLIF(owner_scope_label, ''), owner_scope_ref, owner_user_id)
WHERE owner_scope_type IS NULL
  OR owner_scope_ref IS NULL
  OR owner_scope_ref = ''
  OR owner_scope_label IS NULL
  OR owner_scope_label = '';

ALTER TABLE owner_contact_directory
  ALTER COLUMN owner_scope_type SET NOT NULL,
  ALTER COLUMN owner_scope_ref SET NOT NULL,
  ALTER COLUMN owner_scope_label SET NOT NULL;

DROP INDEX IF EXISTS idx_owner_contact_directory_owner_source_external_ref;
DROP INDEX IF EXISTS idx_owner_contact_directory_owner_source_platform_external_ref;

CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_contact_directory_owner_scope_external_ref
  ON owner_contact_directory (
    owner_user_id,
    source,
    platform,
    owner_scope_type,
    owner_scope_ref,
    external_ref
  )
  WHERE external_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_owner_contact_directory_owner_scope
  ON owner_contact_directory (
    owner_user_id,
    owner_scope_type,
    owner_scope_ref,
    is_active,
    updated_at DESC
  );
