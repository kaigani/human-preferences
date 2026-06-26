-- ════════════════════════════════════════════════════════════════════
--  Life events — the BIOGRAPHICAL layer of the mindfile.
--  Deliberately SEPARATE from pairs/judgments: these are dated facts,
--  roles, and turning points, not A/B preferences. Private by default,
--  never included in the anonymous preference exports (records/DPO/rubric).
--  Dates make events anchors on the preference timeline (drift context).
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS life_events (
  id             TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL DEFAULT 1,
  category       TEXT NOT NULL,                 -- one of the 12 canonical categories
  subcategory    TEXT,
  title          TEXT NOT NULL,                 -- the "what" in a line
  detail         TEXT,                          -- what changed afterward / why it matters
  date_start     TEXT,                          -- ISO, approximate ok: YYYY | YYYY-MM | YYYY-MM-DD
  date_end       TEXT,                          -- for chapters/spans; null = point event
  ongoing        INTEGER NOT NULL DEFAULT 0,    -- 1 = still unfolding
  people         TEXT,                          -- who was involved
  place          TEXT,
  significance   INTEGER,                       -- 1–5, how central it feels now
  privacy        TEXT NOT NULL DEFAULT 'private', -- private | sensitive | public
  status         TEXT NOT NULL DEFAULT 'past',  -- past | current
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_life_category ON life_events(category);
CREATE INDEX IF NOT EXISTS idx_life_date ON life_events(date_start);
