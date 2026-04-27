ALTER TABLE owner_contact_import_batches
  ADD COLUMN IF NOT EXISTS platform TEXT NULL;

ALTER TABLE owner_contact_import_batches
  DROP CONSTRAINT IF EXISTS owner_contact_import_batches_platform_check;

ALTER TABLE owner_contact_import_batches
  ADD CONSTRAINT owner_contact_import_batches_platform_check
  CHECK (
    platform IS NULL OR
    platform IN ('instagram', 'facebook', 'whatsapp', 'email', 'website', 'manual_upload', 'unknown')
  );

ALTER TABLE owner_contact_directory
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE owner_contact_directory
  DROP CONSTRAINT IF EXISTS owner_contact_directory_platform_check;

ALTER TABLE owner_contact_directory
  ADD CONSTRAINT owner_contact_directory_platform_check
  CHECK (platform IN ('instagram', 'facebook', 'whatsapp', 'email', 'website', 'manual_upload', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_owner_contact_directory_owner_platform
  ON owner_contact_directory (owner_user_id, platform, is_active, updated_at DESC);
