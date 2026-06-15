// Data-access layer: prepared statements over the SQLite DB.
// Shared by the server routes and (some) worker code.
import { nanoid } from 'nanoid';
import { getDb } from './db.js';
import type {
  Choice,
  JudgmentInput,
  PairForJudging,
  Session,
  StatsSummary,
  Theme,
} from '@shared/types.js';

const db = getDb();

function parseMeta(json: string | null): Record<string, unknown> | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

// ── sessions ────────────────────────────────────────────────────────
const insertSession = db.prepare(
  `INSERT INTO sessions (id, app_version, device_label) VALUES (?, ?, ?)`,
);
const selectSession = db.prepare(`SELECT * FROM sessions WHERE id = ?`);
const endSessionStmt = db.prepare(
  `UPDATE sessions SET ended_at = datetime('now') WHERE id = ? AND ended_at IS NULL`,
);

export function createSession(deviceLabel?: string, appVersion = '0.1.0'): Session {
  const id = `sess_${nanoid(12)}`;
  insertSession.run(id, appVersion, deviceLabel ?? null);
  return selectSession.get(id) as Session;
}

export function endSession(id: string): void {
  endSessionStmt.run(id);
}

// ── judge queue ─────────────────────────────────────────────────────
const selectQueueAll = db.prepare(`
  SELECT p.id, p.context, p.content_type, p.option_a, p.option_b,
         p.a_meta_json, p.b_meta_json, p.axis,
         t.id AS theme_id, t.label AS theme_label, t.kind AS theme_kind
  FROM pairs p
  LEFT JOIN themes t ON t.id = p.theme_id
  WHERE p.status = 'queued'
  ORDER BY p.created_at
  LIMIT ?
`);

const selectQueueByTheme = db.prepare(`
  SELECT p.id, p.context, p.content_type, p.option_a, p.option_b,
         p.a_meta_json, p.b_meta_json, p.axis,
         t.id AS theme_id, t.label AS theme_label, t.kind AS theme_kind
  FROM pairs p
  LEFT JOIN themes t ON t.id = p.theme_id
  WHERE p.status = 'queued' AND p.theme_id = ?
  ORDER BY p.created_at
  LIMIT ?
`);

export function getNextPairs(limit = 10, themeId?: string): PairForJudging[] {
  const rows = (themeId ? selectQueueByTheme.all(themeId, limit) : selectQueueAll.all(limit)) as any[];
  return rows.map((r) => ({
    id: r.id,
    context: r.context,
    content_type: r.content_type,
    options: {
      a: { content: r.option_a, meta: parseMeta(r.a_meta_json) },
      b: { content: r.option_b, meta: parseMeta(r.b_meta_json) },
    },
    axis: r.axis,
    theme: r.theme_id
      ? { id: r.theme_id, label: r.theme_label, kind: r.theme_kind }
      : null,
  }));
}

// ── judgments ───────────────────────────────────────────────────────
const insertJudgment = db.prepare(`
  INSERT INTO judgments (id, pair_id, session_id, choice, note, latency_ms)
  VALUES (@id, @pair_id, @session_id, @choice, @note, @latency_ms)
`);
const updatePairStatus = db.prepare(`UPDATE pairs SET status = ? WHERE id = ?`);
const selectPairStatus = db.prepare(`SELECT status FROM pairs WHERE id = ?`);

const statusForChoice: Record<Choice, string> = {
  a: 'judged',
  b: 'judged',
  no_preference: 'judged',
  skip: 'skipped',
};

/** Record a judgment and flip the pair's status, atomically. */
export const recordJudgment = db.transaction((input: JudgmentInput) => {
  const existing = selectPairStatus.get(input.pair_id) as { status: string } | undefined;
  if (!existing) throw new Error(`pair not found: ${input.pair_id}`);

  const id = `judg_${nanoid(12)}`;
  insertJudgment.run({
    id,
    pair_id: input.pair_id,
    session_id: input.session_id,
    choice: input.choice,
    note: input.note ?? null,
    latency_ms: input.latency_ms ?? null,
  });
  updatePairStatus.run(statusForChoice[input.choice], input.pair_id);
  return id;
});

// ── themes ──────────────────────────────────────────────────────────
const selectThemes = db.prepare(`SELECT * FROM themes ORDER BY sort_order, label`);
export function listThemes(): Theme[] {
  return selectThemes.all() as Theme[];
}

// ── stats ───────────────────────────────────────────────────────────
const countJudged = db.prepare(
  `SELECT COUNT(*) AS n FROM judgments WHERE choice IN ('a','b','no_preference')`,
);
const countPairs = db.prepare(`SELECT COUNT(*) AS n FROM pairs`);
const countQueued = db.prepare(`SELECT COUNT(*) AS n FROM pairs WHERE status = 'queued'`);
const statsByTheme = db.prepare(`
  SELECT t.id AS theme_id, t.label AS label, t.kind AS kind,
         SUM(CASE WHEN p.status = 'judged'  THEN 1 ELSE 0 END) AS judged,
         SUM(CASE WHEN p.status = 'queued'  THEN 1 ELSE 0 END) AS queued
  FROM themes t
  LEFT JOIN pairs p ON p.theme_id = t.id
  GROUP BY t.id
  ORDER BY t.sort_order, t.label
`);

// ── current-events feed ─────────────────────────────────────────────
const selectFeed = db.prepare(`
  SELECT s.id, s.source_ref, s.context, s.created_at,
         COUNT(p.id) AS pair_count,
         SUM(CASE WHEN p.status = 'queued' THEN 1 ELSE 0 END) AS queued
  FROM seeds s
  LEFT JOIN pairs p ON p.seed_id = s.id
  WHERE s.source_type = 'current_event'
  GROUP BY s.id
  ORDER BY s.created_at DESC
  LIMIT ?
`);

export interface FeedItem {
  id: string;
  title: string;
  source: string;
  when: string;
  pair_count: number;
  queued: number;
}

export function getFeed(limit = 8): FeedItem[] {
  return (selectFeed.all(limit) as any[]).map((r) => ({
    id: r.id,
    title: r.context,
    source: 'Current events',
    when: r.created_at,
    pair_count: r.pair_count ?? 0,
    queued: r.queued ?? 0,
  }));
}

const DEFAULT_GOAL = 100_000;

export function getStats(goal = DEFAULT_GOAL): StatsSummary {
  const total_judged = (countJudged.get() as { n: number }).n;
  const total_pairs = (countPairs.get() as { n: number }).n;
  const queued = (countQueued.get() as { n: number }).n;
  const by_theme = (statsByTheme.all() as any[]).map((r) => ({
    theme_id: r.theme_id,
    label: r.label,
    kind: r.kind,
    judged: r.judged ?? 0,
    queued: r.queued ?? 0,
  }));
  return {
    total_judged,
    total_pairs,
    queued,
    goal,
    percent: goal > 0 ? Math.min(100, (total_judged / goal) * 100) : 0,
    by_theme,
  };
}
