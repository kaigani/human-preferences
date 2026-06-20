// Batch-exchange helpers shared by the CLI commands.
// The shared folder is a passive artifact store; nothing here talks to a model.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { nanoid } from 'nanoid';
import 'dotenv/config';
import { getDb } from '../server/db.js';
import { pairContentHash } from '../shared/hash.js';
import { cosine } from '../shared/cosine.js';
import type {
  BatchManifest,
  GeneratedPairLine,
  JobSpec,
  SeedLine,
  SourceType,
  ThemeKind,
} from '../shared/types.js';

const DEFAULT_SHARED = '/Users/kaigani/Documents/PC_SHARED/260615-gemma-runner';
export const SHARED_DIR = resolve(process.env.SHARED_RUNNER_DIR ?? DEFAULT_SHARED);
export const JOBS_DIR = join(SHARED_DIR, 'jobs');

export function jobDir(jobId: string): string {
  return join(JOBS_DIR, jobId);
}

export function newJobId(sourceType: string): string {
  // jobs sort chronologically by id; nanoid keeps them unique.
  return `${sourceType}-${nanoid(10)}`;
}

// ── JSONL helpers ───────────────────────────────────────────────────
export function writeJsonl<T>(path: string, rows: T[]): void {
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

export function readJsonl<T>(path: string): T[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

// ── Export a job (job.json + seeds.jsonl) to the shared folder ───────
export function writeJob(spec: JobSpec, seeds: SeedLine[]): string {
  mkdirSync(jobDir(spec.job_id), { recursive: true });
  writeFileSync(join(jobDir(spec.job_id), 'job.json'), JSON.stringify(spec, null, 2), 'utf8');
  writeJsonl(join(jobDir(spec.job_id), 'seeds.jsonl'), seeds);
  return jobDir(spec.job_id);
}

export function listJobs(): Array<{ job_id: string; hasResults: boolean; hasComplete: boolean }> {
  if (!existsSync(JOBS_DIR)) return [];
  return readdirSync(JOBS_DIR)
    .filter((d) => existsSync(join(JOBS_DIR, d, 'job.json')))
    .map((d) => ({
      job_id: d,
      hasResults: existsSync(join(JOBS_DIR, d, 'pairs.jsonl')),
      hasComplete: existsSync(join(JOBS_DIR, d, 'COMPLETE.json')),
    }));
}

// ── Ingest generated pairs into SQLite ──────────────────────────────
const db = getDb();

const upsertTheme = db.prepare(
  `INSERT OR IGNORE INTO themes (id, label, kind) VALUES (?, ?, ?)`,
);
const upsertSeed = db.prepare(`
  INSERT OR IGNORE INTO seeds (id, source_type, source_ref, theme_id, context)
  VALUES (@id, @source_type, @source_ref, @theme_id, @context)
`);
const insertPair = db.prepare(`
  INSERT OR IGNORE INTO pairs
    (id, schema_version, seed_id, theme_id, context, content_type,
     option_a, option_b, a_meta_json, b_meta_json, generator_provider, generator_model,
     generator_prompt_id, generation_strength, axis, content_hash,
     status, embedding, flagged_reason)
  VALUES
    (@id, 1, @seed_id, @theme_id, @context, @content_type,
     @option_a, @option_b, @a_meta_json, @b_meta_json, @provider, @model,
     @prompt_id, @strength, @axis, @content_hash,
     @status, @embedding, @flagged_reason)
`);

// Cosine threshold above which a new pair is treated as a near-duplicate.
export const DEDUP_THRESHOLD = Number(process.env.DEDUP_THRESHOLD ?? 0.9);

const selectThemeEmbeds = db.prepare(
  `SELECT id, embedding FROM pairs
   WHERE theme_id IS @theme AND embedding IS NOT NULL AND status IN ('queued','judged')`,
);

/** Load kept (non-flagged) embedded pairs for a theme into memory. */
function loadThemeVectors(themeId: string | null): Array<{ id: string; vec: number[] }> {
  const rows = selectThemeEmbeds.all({ theme: themeId }) as Array<{ id: string; embedding: string }>;
  const out: Array<{ id: string; vec: number[] }> = [];
  for (const r of rows) {
    try {
      out.push({ id: r.id, vec: JSON.parse(r.embedding) });
    } catch {
      /* skip unparseable */
    }
  }
  return out;
}

/** Nearest existing vector by cosine; null if none. */
function nearest(vec: number[], pool: Array<{ id: string; vec: number[] }>): { id: string; sim: number } | null {
  let best: { id: string; sim: number } | null = null;
  for (const p of pool) {
    const sim = cosine(vec, p.vec);
    if (!best || sim > best.sim) best = { id: p.id, sim };
  }
  return best;
}
const upsertTag = db.prepare(`INSERT OR IGNORE INTO tags (id, label) VALUES (?, ?)`);
const linkTag = db.prepare(
  `INSERT OR IGNORE INTO entity_tags (tag_id, entity_type, entity_id) VALUES (?, 'pair', ?)`,
);

const recordJob = db.prepare(`
  INSERT INTO generation_jobs
    (id, status, provider, model, source_type, params_json, requested_count, produced_count, finished_at)
  VALUES (@id, 'done', @provider, @model, @source_type, @params_json, @requested_count, @produced_count, datetime('now'))
`);

function kindForSource(source: SourceType): ThemeKind {
  if (source === 'shp') return 'shp_domain';
  if (source === 'current_event') return 'current_events';
  return 'custom';
}

const FOUNDATIONS = new Set(['care', 'fairness', 'loyalty', 'authority', 'purity', 'liberty']);
/** For morality pairs, derive foundation tags from an "<a> vs <b>" axis if the
 *  model didn't supply explicit tags. */
function foundationTags(themeId: string | null, axis: string | null): string[] {
  if (themeId !== 'morality' || !axis) return [];
  const parts = axis.toLowerCase().split(/\s+vs\.?\s+/).map((s) => s.trim());
  const found = parts.filter((p) => FOUNDATIONS.has(p));
  return found.length === 2 ? found : [];
}

export interface IngestResult {
  read: number;
  inserted: number;
  duplicates: number;
  flagged: number;
}

/** Ingest an array of generated pair lines. Idempotent (content_hash dedup).
 *  Embedded pairs whose cosine similarity to a kept pair in the same theme is
 *  ≥ DEDUP_THRESHOLD are inserted as 'flagged' (kept out of the judge queue). */
export const ingestPairs = db.transaction(
  (lines: GeneratedPairLine[], jobId: string): IngestResult => {
    let inserted = 0;
    let flagged = 0;
    const vecCache = new Map<string, Array<{ id: string; vec: number[] }>>();

    for (const line of lines) {
      // ensure theme exists (FK) — upsert a minimal row if unknown
      if (line.theme_id) {
        const label = line.theme_id.includes(':') ? line.theme_id.split(':')[1] : line.theme_id;
        upsertTheme.run(line.theme_id, label, kindForSource(line.source_type));
      }
      // ensure seed exists (FK)
      upsertSeed.run({
        id: line.seed_id,
        source_type: line.source_type,
        source_ref: line.source_ref,
        theme_id: line.theme_id,
        context: line.seed_context ?? line.context,
      });

      // semantic-dedup decision
      let status = 'queued';
      let flagged_reason: string | null = null;
      let embeddingJson: string | null = null;
      const vec = line.embedding;
      const key = line.theme_id ?? '__null__';
      if (vec && vec.length) {
        embeddingJson = JSON.stringify(vec);
        let pool = vecCache.get(key);
        if (!pool) {
          pool = loadThemeVectors(line.theme_id ?? null);
          vecCache.set(key, pool);
        }
        const near = nearest(vec, pool);
        if (near && near.sim >= DEDUP_THRESHOLD) {
          status = 'flagged';
          flagged_reason = `near-dup of ${near.id} (cos ${near.sim.toFixed(3)})`;
        }
      }

      const content_hash = pairContentHash(line.context, line.option_a, line.option_b);
      const id = `pair_${nanoid(12)}`;
      const info = insertPair.run({
        id,
        seed_id: line.seed_id,
        theme_id: line.theme_id,
        context: line.context,
        content_type: line.content_type ?? 'text',
        option_a: line.option_a,
        option_b: line.option_b,
        a_meta_json: line.a_meta ? JSON.stringify(line.a_meta) : null,
        b_meta_json: line.b_meta ? JSON.stringify(line.b_meta) : null,
        provider: line.provider,
        model: line.model,
        prompt_id: line.prompt_id,
        strength: line.strength ?? null,
        axis: line.axis,
        content_hash,
        status,
        embedding: embeddingJson,
        flagged_reason,
      });

      if (info.changes) {
        inserted += 1;
        const tags = line.tags?.length ? line.tags : foundationTags(line.theme_id, line.axis);
        for (const t of tags) {
          upsertTag.run(t, t);
          linkTag.run(t, id);
        }
        if (status === 'flagged') {
          flagged += 1;
        } else if (vec && vec.length) {
          // compare later pairs in this batch against this one too
          vecCache.get(key)!.push({ id, vec });
        }
      }
    }

    recordJob.run({
      id: `job_${nanoid(12)}`,
      provider: lines[0]?.provider ?? 'manual',
      model: lines[0]?.model ?? 'unknown',
      source_type: lines[0]?.source_type ?? 'manual',
      params_json: JSON.stringify({ job_id: jobId }),
      requested_count: lines.length,
      produced_count: inserted,
    });

    return { read: lines.length, inserted, duplicates: lines.length - inserted, flagged };
  },
);

export function writeManifest(jobId: string, manifest: BatchManifest): void {
  writeFileSync(join(jobDir(jobId), 'INGESTED.json'), JSON.stringify(manifest, null, 2), 'utf8');
}
