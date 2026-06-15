// Batch-exchange helpers shared by the CLI commands.
// The shared folder is a passive artifact store; nothing here talks to a model.
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { nanoid } from 'nanoid';
import 'dotenv/config';
import { getDb } from '../server/db.js';
import { pairContentHash } from '../shared/hash.js';
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
     option_a, option_b, generator_provider, generator_model,
     generator_prompt_id, generation_strength, axis, content_hash, status)
  VALUES
    (@id, 1, @seed_id, @theme_id, @context, @content_type,
     @option_a, @option_b, @provider, @model,
     @prompt_id, @strength, @axis, @content_hash, 'queued')
`);
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

export interface IngestResult {
  read: number;
  inserted: number;
  duplicates: number;
}

/** Ingest an array of generated pair lines. Idempotent (content_hash dedup). */
export const ingestPairs = db.transaction(
  (lines: GeneratedPairLine[], jobId: string): IngestResult => {
    let inserted = 0;
    for (const line of lines) {
      // ensure theme exists (FK) — upsert a minimal row if unknown
      if (line.theme_id) {
        const label = line.theme_id.includes(':')
          ? line.theme_id.split(':')[1]
          : line.theme_id;
        upsertTheme.run(line.theme_id, label, kindForSource(line.source_type));
      }
      // ensure seed exists (FK)
      upsertSeed.run({
        id: line.seed_id,
        source_type: line.source_type,
        source_ref: line.source_ref,
        theme_id: line.theme_id,
        context: line.context,
      });
      const content_hash = pairContentHash(line.context, line.option_a, line.option_b);
      const info = insertPair.run({
        id: `pair_${nanoid(12)}`,
        seed_id: line.seed_id,
        theme_id: line.theme_id,
        context: line.context,
        content_type: line.content_type ?? 'text',
        option_a: line.option_a,
        option_b: line.option_b,
        provider: line.provider,
        model: line.model,
        prompt_id: line.prompt_id,
        strength: line.strength ?? null,
        axis: line.axis,
        content_hash,
      });
      inserted += info.changes;
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

    return { read: lines.length, inserted, duplicates: lines.length - inserted };
  },
);

export function writeManifest(jobId: string, manifest: BatchManifest): void {
  writeFileSync(join(jobDir(jobId), 'INGESTED.json'), JSON.stringify(manifest, null, 2), 'utf8');
}
