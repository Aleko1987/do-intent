DROP INDEX IF EXISTS idx_owner_contact_directory_owner_source_external_ref;

CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_contact_directory_owner_source_platform_external_ref
  ON owner_contact_directory (owner_user_id, source, platform, external_ref)
  WHERE external_ref IS NOT NULL;
