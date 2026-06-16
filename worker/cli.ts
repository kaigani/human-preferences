// gemma-runner exchange CLI. Run via: npm run cli -- <command> [flags]
//   export-job   write a job (job.json + seeds.jsonl) to the shared folder
//   ingest-batch read a finished job's pairs.jsonl back into SQLite
//   ingest-file  ingest an arbitrary pairs.jsonl (Claude-Code / manual path)
//   list-jobs    show jobs in the shared folder and their state
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDb, migrate } from '../server/db.js';
import { themeSeeds } from './seeds/themes.js';
import { selectShpSeeds } from './seeds/select-shp.js';
import {
  DEDUP_THRESHOLD,
  SHARED_DIR,
  ingestPairs,
  jobDir,
  listJobs,
  newJobId,
  readJsonl,
  writeJob,
  writeManifest,
} from './protocol.js';
import { auditDupes, exportEmbedRequests, ingestEmbeddings } from './embeddings.js';
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
  const flaggedNote = res.flagged ? `, ${res.flagged} flagged near-dup` : '';
  console.log(
    `✓ Ingested ${res.inserted} new pair(s) (${res.inserted - res.flagged} queued${flaggedNote}, ${res.duplicates} exact dup) from ${lines.length} line(s).`,
  );
  return res;
}

switch (cmd) {
  case 'export-job': {
    const source = (f.source ?? 'theme') as 'theme' | 'shp';
    const pairsPerSeed = Number(f['pairs-per-seed'] ?? (source === 'shp' ? 2 : 5));
    const seedCount = Number(f.seeds ?? 20);

    let seeds: SeedLine[];
    let jobLabel: string;
    if (source === 'theme') {
      if (!f.theme) throw new Error('export-job --source theme requires --theme <id>');
      seeds = themeSeeds(f.theme, seedCount, pairsPerSeed);
      jobLabel = `theme-${f.theme}`;
    } else if (source === 'shp') {
      seeds = selectShpSeeds(seedCount, pairsPerSeed, f.theme);
      if (!seeds.length) throw new Error('no unused SHP seeds — run `npm run import:shp -- --spread --limit 2000` first');
      jobLabel = f.theme ? `shp-${f.theme.replace('shp:', '')}` : 'shp';
    } else {
      throw new Error(`unknown --source ${source} (use theme | shp)`);
    }

    const job_id = newJobId(jobLabel);
    const spec: JobSpec = {
      job_id,
      created_at: new Date().toISOString(),
      source_type: source,
      provider: (f.provider as JobSpec['provider']) ?? 'ollama',
      model: f.model ?? 'gemma2',
      prompt_id: f['prompt-id'] ?? (source === 'shp' ? 'opinion_stance_v1' : 'stance_contrast_v1'),
      pairs_per_seed: pairsPerSeed,
      requested_count: seeds.length * pairsPerSeed,
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

  case 'export-embed': {
    const { count, path } = exportEmbedRequests();
    console.log(`✓ Wrote ${count} embed request(s) → ${path}`);
    if (count) console.log(`  On the PC:  python3 -m pairgen.cli embed   →  then: npm run cli -- ingest-embeddings`);
    else console.log('  (every pair already has an embedding)');
    break;
  }

  case 'ingest-embeddings': {
    const { updated, missing } = ingestEmbeddings();
    console.log(`✓ Stored ${updated} embedding(s)${missing ? ` (${missing} returned empty)` : ''}.`);
    console.log(`  Next: npm run cli -- audit-dupes${f.apply ? '' : ' [--apply]'}`);
    break;
  }

  case 'audit-dupes': {
    const threshold = Number(f.threshold ?? DEDUP_THRESHOLD);
    const apply = 'apply' in f;
    const { scanned, dupes, applied } = auditDupes({ theme: f.theme, threshold, apply });
    console.log(`Scanned ${scanned} embedded pair(s) at cosine ≥ ${threshold}. Found ${dupes.length} near-duplicate(s).`);
    for (const d of dupes.slice(0, 25)) {
      console.log(`  • ${d.sim.toFixed(3)}  ${d.judged ? '[judged] ' : ''}${d.theme ?? ''}`);
      console.log(`      “${d.context.slice(0, 70)}”`);
      console.log(`      ~ “${d.of_context.slice(0, 70)}”  (${d.dup_of})`);
    }
    if (dupes.length > 25) console.log(`  … and ${dupes.length - 25} more`);
    if (apply) console.log(`✓ Flagged ${applied} queued near-dup(s) (judged pairs left untouched).`);
    else if (dupes.length) console.log(`  Re-run with --apply to flag these out of the queue.`);
    break;
  }

  default:
    console.log(`Usage: npm run cli -- <command>
  export-job        --source theme --theme <id> [--seeds 20] [--pairs-per-seed 5]
  export-job        --source shp [--theme shp:<domain>] [--seeds 20] [--pairs-per-seed 2]
  ingest-batch      --job <job_id>
  ingest-file       --file <path-to-pairs.jsonl> [--job <id>]
  list-jobs
  export-embed                            backfill: write texts needing embeddings
  ingest-embeddings                       backfill: store vectors the PC produced
  audit-dupes       [--theme <id>] [--threshold 0.9] [--apply]`);
}
