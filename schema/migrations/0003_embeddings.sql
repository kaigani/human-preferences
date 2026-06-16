-- Semantic dedup: store an embedding vector per pair (JSON array of floats)
-- and the reason a pair was flagged as a near-duplicate.
ALTER TABLE pairs ADD COLUMN embedding TEXT;
ALTER TABLE pairs ADD COLUMN flagged_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_pairs_has_embedding ON pairs(theme_id) WHERE embedding IS NOT NULL;
