-- Make lead_id nullable in intent_events to support anonymous events
ALTER TABLE intent_events 
  ALTER COLUMN lead_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS intent_events_lead_id_fkey;

-- Re-add foreign key constraint but allow NULL
ALTER TABLE intent_events
  ADD CONSTRAINT intent_events_lead_id_fkey 
  FOREIGN KEY (lead_id) REFERENCES marketing_leads(id) ON DELETE CASCADE;

