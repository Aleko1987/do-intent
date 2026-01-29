-- Insert default scoring rules
INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'apollo_open', 4, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type='apollo_open');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'apollo_click', 6, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type='apollo_click');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'apollo_reply', 20, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type='apollo_reply');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'web_visit', 1, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type='web_visit');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'web_repeat_visit_7d', 3, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type='web_repeat_visit_7d');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'web_scroll_60', 2, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type='web_scroll_60');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'web_pricing_view', 7, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type='web_pricing_view');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'web_whatsapp_click', 12, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type='web_whatsapp_click');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'form_submit', 20, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type='form_submit');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'booking_click', 20, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type='booking_click');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'inbound_whatsapp', 20, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type='inbound_whatsapp');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'manual_call', 3, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type='manual_call');

INSERT INTO scoring_rules(event_type, points, is_active)
SELECT 'manual_note', 0, true
WHERE NOT EXISTS (SELECT 1 FROM scoring_rules WHERE event_type='manual_note');
