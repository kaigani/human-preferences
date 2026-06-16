// Backfill embeddings for existing pairs (via the PC embed step) and audit the
// corpus for semantic near-duplicates.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb } from '../server/db.js';
import { cosine, pairEmbedText } from '../shared/cosine.js';
import { SHARED_DIR } from './protocol.js';

const db = getDb();
const EMBED_DIR = join(SHARED_DIR, 'embed');

// ── backfill: export texts needing embeddings → PC embeds → ingest vectors ──
export function exportEmbedRequests(): { count: number; path: string } {
  const rows = db
    .prepare(`SELECT id, context, option_a, option_b FROM pairs WHERE embedding IS NULL`)
    .all() as Array<{ id: string; context: string; option_a: string; option_b: string }>;
  mkdirSync(EMBED_DIR, { recursive: true });
  const path = join(EMBED_DIR, 'requests.jsonl');
  const lines = rows.map((r) =>
    JSON.stringify({ pair_id: r.id, text: pairEmbedText(r.context, r.option_a, r.option_b) }),
  );
  writeFileSync(path, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  return { count: rows.length, path };
}

export function ingestEmbeddings(): { updated: number; missing: number } {
  const path = join(EMBED_DIR, 'results.jsonl');
  if (!existsSync(path)) throw new Error(`no results at ${path} — run the PC embed step first`);
  const rows = readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { pair_id: string; embedding: number[] | null });
  const upd = db.prepare(`UPDATE pairs SET embedding = ? WHERE id = ? AND embedding IS NULL`);
  let missing = 0;
  const tx = db.transaction((items: typeof rows) => {
    let n = 0;
    for (const r of items) {
      if (r.embedding && r.embedding.length) n += upd.run(JSON.stringify(r.embedding), r.pair_id).changes;
      else missing += 1;
    }
    return n;
  });
  return { updated: tx(rows), missing };
}

// ── audit: find semantic near-duplicates among kept (queued/judged) pairs ──
export interface DupHit {
  id: string;
  theme: string | null;
  dup_of: string;
  sim: number;
  context: string;
  of_context: string;
  judged: boolean;
}

export function auditDupes(opts: { theme?: string; threshold: number; apply: boolean }): {
  scanned: number;
  dupes: DupHit[];
  applied: number;
} {
  const rows = db
    .prepare(
      `SELECT id, theme_id, context, option_a, option_b, embedding, status, created_at
       FROM pairs
       WHERE embedding IS NOT NULL AND status IN ('queued','judged')
         AND (@theme IS NULL OR theme_id = @theme)
       ORDER BY theme_id, created_at`,
    )
    .all({ theme: opts.theme ?? null }) as any[];

  // greedy clustering per theme: earliest pair is the representative, later
  // pairs within `threshold` cosine are near-duplicates of it.
  const byTheme = new Map<string, any[]>();
  for (const r of rows) {
    const k = r.theme_id ?? '__null__';
    (byTheme.get(k) ?? byTheme.set(k, []).get(k)!).push(r);
  }

  const dupes: DupHit[] = [];
  for (const [, list] of byTheme) {
    const kept: Array<{ id: string; vec: number[]; context: string }> = [];
    for (const r of list) {
      let vec: number[];
      try {
        vec = JSON.parse(r.embedding);
      } catch {
        continue;
      }
      let best: { id: string; sim: number; context: string } | null = null;
      for (const k of kept) {
        const sim = cosine(vec, k.vec);
        if (!best || sim > best.sim) best = { id: k.id, sim, context: k.context };
      }
      if (best && best.sim >= opts.threshold) {
        dupes.push({
          id: r.id,
          theme: r.theme_id,
          dup_of: best.id,
          sim: best.sim,
          context: r.context,
          of_context: best.context,
          judged: r.status === 'judged',
        });
      } else {
        kept.push({ id: r.id, vec, context: r.context });
      }
    }
  }

  // apply: flag only queued near-dups (never touch already-judged pairs)
  let applied = 0;
  if (opts.apply && dupes.length) {
    const upd = db.prepare(
      `UPDATE pairs SET status='flagged', flagged_reason=? WHERE id=? AND status='queued'`,
    );
    const tx = db.transaction((ds: DupHit[]) => {
      let n = 0;
      for (const d of ds) n += upd.run(`near-dup of ${d.dup_of} (cos ${d.sim.toFixed(3)})`, d.id).changes;
      return n;
    });
    applied = tx(dupes);
  }

  return { scanned: rows.length, dupes, applied };
}
