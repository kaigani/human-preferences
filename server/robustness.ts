// Profile Robustness — a single legible signal of how complete the preference
// profile is, from three sub-scores (breadth / depth / consistency), plus the
// per-region ledger and the tier ladder.
import { getDb } from './db.js';
import {
  CALIBRATED_AT,
  REGIONS,
  RICH_AT,
  regionForTheme,
  regionState,
  tierForCount,
  type RegionState,
} from '../shared/regions.js';

const db = getDb();

export interface RegionStat {
  id: string;
  label: string;
  judged: number;
  queued: number;
  state: RegionState;
}

export interface RobustnessSummary {
  robustness: number; // 0-100 composite
  breadth: number;
  depth: number;
  consistency: number;
  streak: number;
  total_judged: number; // decisive (a/b) — the DPO-usable count
  tier: { current: string; next: string | null; to_next: number; unlocks: string };
  regions: RegionStat[];
}

const byThemeStmt = db.prepare(`
  SELECT p.theme_id AS theme_id, t.kind AS kind,
         SUM(CASE WHEN p.status='judged' THEN 1 ELSE 0 END) AS judged,
         SUM(CASE WHEN p.status='queued' THEN 1 ELSE 0 END) AS queued,
         COUNT(*) AS total
  FROM pairs p
  LEFT JOIN themes t ON t.id = p.theme_id
  GROUP BY p.theme_id
`);

const decisivenessStmt = db.prepare(
  `SELECT SUM(CASE WHEN choice IN ('a','b') THEN 1 ELSE 0 END) AS dec, COUNT(*) AS tot
   FROM judgments WHERE choice IN ('a','b','no_preference')`,
);
const decisiveCountStmt = db.prepare(`SELECT COUNT(*) AS n FROM judgments WHERE choice IN ('a','b')`);

function addDays(d: string, n: number): string {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Consecutive days (ending today or yesterday) with at least one judgment. */
function computeStreak(): number {
  const today = (db.prepare(`SELECT date('now') AS d`).get() as { d: string }).d;
  const days = (db.prepare(`SELECT DISTINCT date(created_at) AS d FROM judgments ORDER BY d DESC`).all() as { d: string }[]).map((r) => r.d);
  if (!days.length) return 0;
  if (days[0] !== today && days[0] !== addDays(today, -1)) return 0;
  let streak = 1;
  let cursor = days[0];
  for (let i = 1; i < days.length; i++) {
    if (days[i] === addDays(cursor, -1)) {
      streak += 1;
      cursor = days[i];
    } else break;
  }
  return streak;
}

export function getRobustness(): RobustnessSummary {
  // aggregate per-theme rows up to regions
  const agg = new Map<string, { judged: number; queued: number; total: number }>();
  for (const r of REGIONS) agg.set(r.id, { judged: 0, queued: 0, total: 0 });
  for (const row of byThemeStmt.all() as any[]) {
    const reg = regionForTheme(row.theme_id, row.kind);
    const m = agg.get(reg)!;
    m.judged += row.judged ?? 0;
    m.queued += row.queued ?? 0;
    m.total += row.total ?? 0;
  }

  const regions: RegionStat[] = REGIONS.map((r) => {
    const m = agg.get(r.id)!;
    const active = m.total > 0;
    return { id: r.id, label: r.label, judged: m.judged, queued: m.queued, state: regionState(active, m.judged) };
  });

  const active = REGIONS.filter((r) => agg.get(r.id)!.total > 0);
  const breadth = active.length
    ? active.filter((r) => agg.get(r.id)!.judged >= CALIBRATED_AT).length / active.length
    : 0;
  const depth = active.length
    ? active.reduce((s, r) => s + Math.min(agg.get(r.id)!.judged / RICH_AT, 1), 0) / active.length
    : 0;

  const dec = decisivenessStmt.get() as { dec: number; tot: number };
  const consistency = dec.tot ? dec.dec / dec.tot : 1;

  const total_judged = (decisiveCountStmt.get() as { n: number }).n;
  const robustness = Math.round((0.4 * breadth + 0.4 * depth + 0.2 * consistency) * 100);

  const t = tierForCount(total_judged);
  return {
    robustness,
    breadth: Math.round(breadth * 100),
    depth: Math.round(depth * 100),
    consistency: Math.round(consistency * 100),
    streak: computeStreak(),
    total_judged,
    tier: {
      current: t.current.label,
      next: t.next?.label ?? null,
      to_next: t.toNext,
      unlocks: t.next?.unlocks ?? t.current.unlocks,
    },
    regions,
  };
}
