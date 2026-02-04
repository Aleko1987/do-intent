-- Website event base scores (ARCHITECTURE.md)
INSERT INTO intent_rules (rule_key, rule_type, event_type, points, description)
SELECT 'base_page_view', 'base_score', 'page_view', 1, 'Page view'
WHERE NOT EXISTS (SELECT 1 FROM intent_rules WHERE rule_key = 'base_page_view');

INSERT INTO intent_rules (rule_key, rule_type, event_type, points, description)
SELECT 'base_time_on_page', 'base_score', 'time_on_page', 2, 'Time on page > 30s'
WHERE NOT EXISTS (SELECT 1 FROM intent_rules WHERE rule_key = 'base_time_on_page');

INSERT INTO intent_rules (rule_key, rule_type, event_type, points, description)
SELECT 'base_scroll_depth', 'base_score', 'scroll_depth', 2, 'Scroll depth > 60%'
WHERE NOT EXISTS (SELECT 1 FROM intent_rules WHERE rule_key = 'base_scroll_depth');

INSERT INTO intent_rules (rule_key, rule_type, event_type, points, description)
SELECT 'base_click', 'base_score', 'click', 3, 'CTA click'
WHERE NOT EXISTS (SELECT 1 FROM intent_rules WHERE rule_key = 'base_click');

INSERT INTO intent_rules (rule_key, rule_type, event_type, points, description)
SELECT 'base_pricing_view', 'base_score', 'pricing_view', 4, 'Pricing page view'
WHERE NOT EXISTS (SELECT 1 FROM intent_rules WHERE rule_key = 'base_pricing_view');

INSERT INTO intent_rules (rule_key, rule_type, event_type, points, description)
SELECT 'base_form_start', 'base_score', 'form_start', 6, 'Form start'
WHERE NOT EXISTS (SELECT 1 FROM intent_rules WHERE rule_key = 'base_form_start');

INSERT INTO intent_rules (rule_key, rule_type, event_type, points, description)
SELECT 'base_form_submit', 'base_score', 'form_submit', 10, 'Form submit'
WHERE NOT EXISTS (SELECT 1 FROM intent_rules WHERE rule_key = 'base_form_submit');

INSERT INTO intent_rules (rule_key, rule_type, event_type, points, description)
SELECT 'base_return_visit', 'base_score', 'return_visit', 5, 'Return visit within 30 days'
WHERE NOT EXISTS (SELECT 1 FROM intent_rules WHERE rule_key = 'base_return_visit');

