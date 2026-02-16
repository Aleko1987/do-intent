-- Clerk user IDs are opaque strings (for example, `user_...`) and are not UUIDs.
-- Normalize `owner_user_id` to TEXT so auth IDs can be stored and queried safely.
ALTER TABLE marketing_leads
  ALTER COLUMN owner_user_id TYPE TEXT;
