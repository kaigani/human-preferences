-- ════════════════════════════════════════════════════════════════════
--  Human Preferences — initial schema (schema_version = 1)
--
--  Model: a PAIR is the SHP/DPO shape (context + option A + option B).
--         A JUDGMENT is the user's labeling event over a pair.
--         They are separate so pairs can sit unjudged in a queue and so
--         re-judging across sessions is possible.
--  Content is typed (text / image_ref / artifact_excerpt / markdown) so
--  the schema generalizes beyond any single use case.
--  (journal_mode=WAL and foreign_keys=ON are set per-connection in
--   server/db.ts, so they are intentionally omitted here — PRAGMA
--   journal_mode cannot run inside the migration transaction.)
-- ════════════════════════════════════════════════════════════════════

-- ── meta / versioning ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ── themes / categories (Design, Living, Power, Culture, + SHP domains) ──
CREATE TABLE IF NOT EXISTS themes (
  id          TEXT PRIMARY KEY,            -- slug, e.g. 'design', 'shp:askculinary'
  label       TEXT NOT NULL,               -- 'Design'
  kind        TEXT NOT NULL,               -- 'abstract' | 'shp_domain' | 'current_events' | 'custom'
  description TEXT,                         -- editorial blurb for the Themes strip
  parent_id   TEXT REFERENCES themes(id),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── seeds: the raw material a pair was generated FROM (provenance origin) ──
CREATE TABLE IF NOT EXISTS seeds (
  id           TEXT PRIMARY KEY,            -- uuid
  source_type  TEXT NOT NULL,               -- 'shp' | 'theme' | 'current_event' | 'manual'
  source_ref   TEXT,                         -- SHP post_id, current-event id, or NULL
  theme_id     TEXT REFERENCES themes(id),
  context      TEXT NOT NULL,               -- the prompt/question the A/B pair sits under
  payload_json TEXT,                         -- raw source row (full SHP row, news meta, ...)
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_type, source_ref)            -- dedup seeds by origin
);

-- ── pairs: the to-judge queue. Mirrors the SHP/DPO triple. ──────────
CREATE TABLE IF NOT EXISTS pairs (
  id                  TEXT PRIMARY KEY,      -- uuid
  schema_version      INTEGER NOT NULL DEFAULT 1,
  seed_id             TEXT REFERENCES seeds(id),
  theme_id            TEXT REFERENCES themes(id),

  -- The DPO/SHP triple --------------------------------------------------
  context             TEXT NOT NULL,         -- denormalized from seed → self-contained for export
  content_type        TEXT NOT NULL DEFAULT 'text', -- 'text'|'image_ref'|'artifact_excerpt'|'markdown'
  option_a            TEXT NOT NULL,
  option_b            TEXT NOT NULL,
  a_meta_json         TEXT,                   -- per-option metadata (image dims, source span, ...)
  b_meta_json         TEXT,

  -- Provenance ----------------------------------------------------------
  generator_provider  TEXT,                   -- 'anthropic'|'ollama'|'claude_code'|'manual'
  generator_model     TEXT,                   -- 'claude-opus-4-8' | 'gemma2' | ...
  generator_prompt_id TEXT,                   -- which generation template produced it
  generation_strength REAL,                   -- model confidence the pair is a clean contrast (0..1)
  axis                TEXT,                   -- the contrast dimension, e.g. 'minimal vs ornate'

  content_hash        TEXT NOT NULL,          -- sha256 of normalized, A/B-sorted (context|A|B)
  status              TEXT NOT NULL DEFAULT 'queued', -- 'queued'|'judged'|'skipped'|'flagged'
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(content_hash)
);
CREATE INDEX IF NOT EXISTS idx_pairs_status ON pairs(status);
CREATE INDEX IF NOT EXISTS idx_pairs_theme  ON pairs(theme_id);
CREATE INDEX IF NOT EXISTS idx_pairs_queue  ON pairs(status, created_at);

-- ── sessions: a contiguous judging run ──────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  started_at   TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at     TEXT,
  app_version  TEXT,
  device_label TEXT
);

-- ── judgments: the user's labeling event ────────────────────────────
CREATE TABLE IF NOT EXISTS judgments (
  id             TEXT PRIMARY KEY,           -- uuid
  schema_version INTEGER NOT NULL DEFAULT 1,
  pair_id        TEXT NOT NULL REFERENCES pairs(id),
  session_id     TEXT NOT NULL REFERENCES sessions(id),
  choice         TEXT NOT NULL,              -- 'a' | 'b' | 'skip' | 'no_preference'
  note           TEXT,                        -- optional free-text rationale
  latency_ms     INTEGER,                     -- time from pair shown to choice
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_judgments_pair    ON judgments(pair_id);
CREATE INDEX IF NOT EXISTS idx_judgments_session ON judgments(session_id);

-- ── tags: free-form labels on pairs OR judgments (many-to-many) ─────
CREATE TABLE IF NOT EXISTS tags (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS entity_tags (
  tag_id      TEXT NOT NULL REFERENCES tags(id),
  entity_type TEXT NOT NULL,                  -- 'pair' | 'judgment'
  entity_id   TEXT NOT NULL,
  PRIMARY KEY (tag_id, entity_type, entity_id)
);

-- ── generation jobs: the worker queue (also how Claude Code enqueues) ──
CREATE TABLE IF NOT EXISTS generation_jobs (
  id              TEXT PRIMARY KEY,
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'running'|'done'|'error'
  provider        TEXT NOT NULL,               -- 'anthropic' | 'ollama'
  model           TEXT NOT NULL,
  source_type     TEXT NOT NULL,               -- 'shp' | 'theme' | 'current_event'
  params_json     TEXT NOT NULL,               -- {themeId,count,shpDomain,promptId,...}
  requested_count INTEGER NOT NULL,
  produced_count  INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  started_at      TEXT,
  finished_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status, created_at);
