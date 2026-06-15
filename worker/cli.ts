// gemma-runner exchange CLI. Run via: npm run cli -- <command> [flags]
//   export-job   write a job (job.json + seeds.jsonl) to the shared folder
//   ingest-batch read a finished job's pairs.jsonl back into SQLite
//   ingest-file  ingest an arbitrary pairs.jsonl (Claude-Code / manual path)
//   list-jobs    show jobs in the shared folder and their state
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDb, migrate } from '../server/db.js';
import { themeSeeds } from './seeds/themes.js';
import {
  SHARED_DIR,
  ingestPairs,
  jobDir,
  listJobs,
  newJobId,
  readJsonl,
  writeJob,
  writeManifest,
} from './protocol.js';
import type { GeneratedPairLine, JobSpec, SeedLine } from '../shared/types.js';

migrate(getDb());

// ── tiny flag parser ──
function flags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i++, i)] : 'true';
      out[key] = val;
    }
  }
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);
const f = flags(rest);

function ingestFromFile(path: string, jobId: string) {
  const lines = readJsonl<GeneratedPairLine>(path);
  const res = ingestPairs(lines, jobId);
  console.log(`✓ Ingested ${res.inserted} new pair(s) (${res.duplicates} dup) from ${lines.length} line(s).`);
  return res;
}

switch (cmd) {
  case 'export-job': {
    const source = f.source ?? 'theme';
    if (source !== 'theme') throw new Error(`only --source theme is supported here (SHP arrives in Phase 3)`);
    const theme = f.theme;
    if (!theme) throw new Error('export-job --source theme requires --theme <id>');
    const seedCount = Number(f.seeds ?? 20);
    const pairsPerSeed = Number(f['pairs-per-seed'] ?? 5);
    const seeds: SeedLine[] = themeSeeds(theme, seedCount, pairsPerSeed);

    const job_id = newJobId(`theme-${theme}`);
    const spec: JobSpec = {
      job_id,
      created_at: new Date().toISOString(),
      source_type: 'theme',
      provider: (f.provider as JobSpec['provider']) ?? 'ollama',
      model: f.model ?? 'gemma2',
      prompt_id: f['prompt-id'] ?? 'stance_contrast_v1',
      pairs_per_seed: pairsPerSeed,
      requested_count: seedCount * pairsPerSeed,
      notes: f.notes,
    };
    const dir = writeJob(spec, seeds);
    console.log(`✓ Wrote job ${job_id}`);
    console.log(`  → ${dir}`);
    console.log(`  ${seeds.length} seed(s) × ${pairsPerSeed} = ${spec.requested_count} pairs requested.`);
    console.log(`  Run the gemma-runner on your PC, then: npm run cli -- ingest-batch --job ${job_id}`);
    break;
  }

  case 'ingest-batch': {
    const job = f.job;
    if (!job) throw new Error('ingest-batch requires --job <job_id>');
    const path = join(jobDir(job), 'pairs.jsonl');
    if (!existsSync(path)) throw new Error(`no pairs.jsonl found for job ${job} at ${path}`);
    const res = ingestFromFile(path, job);
    writeManifest(job, {
      job_id: job,
      status: 'complete',
      produced_count: res.inserted,
      seed_count: 0,
      failures: 0,
      completed_at: new Date().toISOString(),
      model: null,
    });
    break;
  }

  case 'ingest-file': {
    const file = f.file;
    if (!file) throw new Error('ingest-file requires --file <path-to-pairs.jsonl>');
    ingestFromFile(file, f.job ?? 'manual');
    break;
  }

  case 'list-jobs': {
    console.log(`Shared folder: ${SHARED_DIR}`);
    const jobs = listJobs();
    if (!jobs.length) {
      console.log('  (no jobs yet)');
      break;
    }
    for (const j of jobs) {
      const state = j.hasComplete ? 'COMPLETE' : j.hasResults ? 'has pairs.jsonl' : 'pending';
      console.log(`  • ${j.job_id.padEnd(28)} ${state}`);
    }
    break;
  }

  default:
    console.log(`Usage: npm run cli -- <command>
  export-job   --source theme --theme <id> [--seeds 20] [--pairs-per-seed 5] [--provider ollama] [--model gemma2]
  ingest-batch --job <job_id>
  ingest-file  --file <path-to-pairs.jsonl> [--job <id>]
  list-jobs`);
}
