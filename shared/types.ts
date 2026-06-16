// ════════════════════════════════════════════════════════════════════
//  Shared domain types — the single source of truth for server, worker,
//  exporters, and the React app (imported via the @shared alias).
//  Keep in sync with schema/migrations/0001_init.sql.
// ════════════════════════════════════════════════════════════════════

export const SCHEMA_VERSION = 1 as const;

export type ThemeKind = 'abstract' | 'shp_domain' | 'current_events' | 'custom';
export type SourceType = 'shp' | 'theme' | 'current_event' | 'manual';
export type ContentType = 'text' | 'markdown' | 'image_ref' | 'artifact_excerpt';
export type GeneratorProvider = 'anthropic' | 'ollama' | 'claude_code' | 'manual';
export type PairStatus = 'queued' | 'judged' | 'skipped' | 'flagged';
export type Choice = 'a' | 'b' | 'skip' | 'no_preference';
export type JobStatus = 'pending' | 'running' | 'done' | 'error';

export interface Theme {
  id: string;
  label: string;
  kind: ThemeKind;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface Seed {
  id: string;
  source_type: SourceType;
  source_ref: string | null;
  theme_id: string | null;
  context: string;
  payload_json: string | null;
  created_at: string;
}

/** A to-judge pair as stored. */
export interface Pair {
  id: string;
  schema_version: number;
  seed_id: string | null;
  theme_id: string | null;
  context: string;
  content_type: ContentType;
  option_a: string;
  option_b: string;
  a_meta_json: string | null;
  b_meta_json: string | null;
  generator_provider: GeneratorProvider | null;
  generator_model: string | null;
  generator_prompt_id: string | null;
  generation_strength: number | null;
  axis: string | null;
  content_hash: string;
  status: PairStatus;
  created_at: string;
}

/** Shape the judging UI consumes (parsed meta, theme label joined in). */
export interface PairForJudging {
  id: string;
  context: string;
  content_type: ContentType;
  options: {
    a: { content: string; meta?: Record<string, unknown> };
    b: { content: string; meta?: Record<string, unknown> };
  };
  axis: string | null;
  theme: { id: string; label: string; kind: ThemeKind } | null;
}

export interface Judgment {
  id: string;
  schema_version: number;
  pair_id: string;
  session_id: string;
  choice: Choice;
  note: string | null;
  latency_ms: number | null;
  created_at: string;
}

/** Body the client POSTs when recording a judgment. */
export interface JudgmentInput {
  pair_id: string;
  session_id: string;
  choice: Choice;
  note?: string | null;
  latency_ms?: number | null;
}

export interface Session {
  id: string;
  started_at: string;
  ended_at: string | null;
  app_version: string | null;
  device_label: string | null;
}

export interface GenerationJob {
  id: string;
  status: JobStatus;
  provider: Exclude<GeneratorProvider, 'claude_code' | 'manual'>;
  model: string;
  source_type: Exclude<SourceType, 'manual'>;
  params_json: string;
  requested_count: number;
  produced_count: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

// ── Generator plugin contract (Phase 2/3) ──────────────────────────
export interface GenerateInput {
  context: string;
  axis?: string;
  count: number;
  promptId: string;
}

export interface GeneratedPair {
  optionA: string;
  optionB: string;
  axis?: string;
  /** Model's confidence (0..1) that this is a clean, meaningful contrast. */
  strength?: number;
}

export interface PairGenerator {
  readonly provider: 'anthropic' | 'ollama';
  readonly model: string;
  generate(input: GenerateInput): Promise<GeneratedPair[]>;
}

// ── Batch exchange protocol (gemma-runner / Claude-Code injection) ──
// The shared folder is a passive artifact store. This app writes a job
// (job.json + seeds.jsonl); the remote runner produces pairs.jsonl +
// COMPLETE.json; this app ingests pairs.jsonl back into SQLite.
// Mirrored on the Python side — keep formats in lockstep.

export interface JobSpec {
  job_id: string;
  created_at: string;
  source_type: Exclude<SourceType, 'manual'>;
  provider: 'ollama' | 'claude_code';
  /** Suggested model; the runner may override from its own config. */
  model: string;
  /** Generation template id the runner should use. */
  prompt_id: string;
  /** Target pairs to produce per seed. */
  pairs_per_seed: number;
  /** Total pairs requested across the job (for progress display). */
  requested_count: number;
  notes?: string;
}

/** One line of seeds.jsonl — a context the runner expands into pairs. */
export interface SeedLine {
  seed_id: string;
  source_type: Exclude<SourceType, 'manual'>;
  source_ref: string | null;
  theme_id: string | null;
  theme_label: string | null;
  /** The context/prompt the A/B pair sits under (SHP history, theme prompt, news item). */
  context: string;
  /** Optional hint at the contrast dimension to explore. */
  axis_hint?: string;
  pairs_per_seed: number;
}

/** One line of pairs.jsonl — a generated A/B pair ready to ingest. */
export interface GeneratedPairLine {
  seed_id: string;
  source_type: SourceType;
  source_ref: string | null;
  theme_id: string | null;
  context: string;
  /** Optional distinct context for the SEED (e.g. a news headline) when it
   *  differs from the pair's own context. Used by the current-events feed. */
  seed_context?: string | null;
  content_type: ContentType;
  option_a: string;
  option_b: string;
  axis: string | null;
  /** 0..1 model confidence this is a clean, meaningful contrast. */
  strength?: number | null;
  provider: GeneratorProvider;
  model: string | null;
  prompt_id: string | null;
  /** Optional embedding vector (computed by the runner) for semantic dedup. */
  embedding?: number[] | null;
}

/** COMPLETE.json — written by the runner when a job finishes. */
export interface BatchManifest {
  job_id: string;
  status: 'complete' | 'partial' | 'error';
  produced_count: number;
  seed_count: number;
  failures: number;
  completed_at: string;
  model: string | null;
  error?: string;
}

// ── API response shapes ────────────────────────────────────────────
export interface StatsSummary {
  total_judged: number;
  total_pairs: number;
  queued: number;
  goal: number;
  percent: number;
  by_theme: Array<{ theme_id: string; label: string; kind: ThemeKind; judged: number; queued: number }>;
}

/** The portable export record (matches schema/preference-record.v1.json). */
export interface PreferenceRecord {
  id: string;
  schema_version: number;
  context: string;
  content_type: ContentType;
  axis: string | null;
  options: {
    a: { content: string; meta?: Record<string, unknown> };
    b: { content: string; meta?: Record<string, unknown> };
  };
  theme: { id: string; label: string; kind: ThemeKind } | null;
  provenance: {
    source_type: SourceType;
    source_ref: string | null;
    generator: { provider: GeneratorProvider; model: string | null; prompt_id: string | null } | null;
    generation_strength: number | null;
  };
  judgment: {
    choice: Choice;
    note: string | null;
    latency_ms: number | null;
    session_id: string | null;
    created_at: string;
  };
  tags: string[];
}
