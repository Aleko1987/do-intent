CREATE TABLE IF NOT EXISTS lead_scoring_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  m1_min INTEGER NOT NULL DEFAULT 0,
  m2_min INTEGER NOT NULL DEFAULT 6,
  m3_min INTEGER NOT NULL DEFAULT 16,
  m4_min INTEGER NOT NULL DEFAULT 31,
  m5_min INTEGER NOT NULL DEFAULT 46,
  auto_push_threshold INTEGER NOT NULL DEFAULT 31,
  decay_points_per_week INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO lead_scoring_config (
  id,
  m1_min,
  m2_min,
  m3_min,
  m4_min,
  m5_min,
  auto_push_threshold,
  decay_points_per_week,
  updated_at
) VALUES (
  1,
  0,
  6,
  16,
  31,
  46,
  31,
  1,
  now()
)
ON CONFLICT (id) DO NOTHING;
