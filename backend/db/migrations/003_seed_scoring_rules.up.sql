-- Insert default scoring rules
INSERT INTO scoring_rules (rule_name, event_type, points, is_hard_intent, stage_hint) VALUES
  ('Apollo Email Open', 'apollo_open', 4, false, 'M2'),
  ('Apollo Email Click', 'apollo_click', 6, false, 'M2'),
  ('Apollo Reply', 'apollo_reply', 20, true, 'M4'),
  ('Website Visit', 'web_visit', 1, false, 'M1'),
  ('Repeat Visit (7d)', 'web_repeat_visit_7d', 3, false, 'M2'),
  ('60% Page Scroll', 'web_scroll_60', 2, false, 'M2'),
  ('Pricing Page View', 'web_pricing_view', 7, false, 'M3'),
  ('WhatsApp Click', 'web_whatsapp_click', 12, true, 'M4'),
  ('Form Submit', 'form_submit', 20, true, 'M4'),
  ('Booking Click', 'booking_click', 20, true, 'M5'),
  ('Inbound WhatsApp', 'inbound_whatsapp', 20, true, 'M5'),
  ('Manual Call', 'manual_call', 3, false, 'M2'),
  ('Manual Note', 'manual_note', 0, false, null)
ON CONFLICT (event_type) DO NOTHING;
