-- Insert default scoring rules
INSERT INTO scoring_rules (event_type, points, is_active) VALUES
  ('apollo_open', 4, true),
  ('apollo_click', 6, true),
  ('apollo_reply', 20, true),
  ('web_visit', 1, true),
  ('web_repeat_visit_7d', 3, true),
  ('web_scroll_60', 2, true),
  ('web_pricing_view', 7, true),
  ('web_whatsapp_click', 12, true),
  ('form_submit', 20, true),
  ('booking_click', 20, true),
  ('inbound_whatsapp', 20, true),
  ('manual_call', 3, true),
  ('manual_note', 0, true)
ON CONFLICT (event_type) DO NOTHING;
