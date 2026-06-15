// Export builders — shared by the CLI wrappers and the server routes.
// Reads judged pairs from SQLite and produces (a) DPO/RLHF JSONL,
// (b) a portable preference-record array, (c) an LLM-judge taste rubric.
import { getDb } from '../server/db.js';
import type { Choice, PreferenceRecord } from '../shared/types.js';

const db = getDb();

interface JudgedRow {
  pair_id: string;
  context: string;
  content_type: string;
  option_a: string;
  option_b: string;
  a_meta_json: string | null;
  b_meta_json: string | null;
  axis: string | null;
  theme_id: string | null;
  theme_label: string | null;
  theme_kind: string | null;
  source_type: string;
  source_ref: string | null;
  provider: string | null;
  model: string | null;
  prompt_id: string | null;
  strength: number | null;
  choice: Choice;
  note: string | null;
  latency_ms: number | null;
  session_id: string;
  judged_at: string;
}

const judgedQuery = (onlyAB: boolean) => `
  SELECT p.id AS pair_id, p.context, p.content_type, p.option_a, p.option_b,
         p.a_meta_json, p.b_meta_json, p.axis,
         p.theme_id, t.label AS theme_label, t.kind AS theme_kind,
         s.source_type, s.source_ref,
         p.generator_provider AS provider, p.generator_model AS model,
         p.generator_prompt_id AS prompt_id, p.generation_strength AS strength,
         j.choice, j.note, j.latency_ms, j.session_id, j.created_at AS judged_at
  FROM judgments j
  JOIN pairs p ON p.id = j.pair_id
  LEFT JOIN themes t ON t.id = p.theme_id
  LEFT JOIN seeds s ON s.id = p.seed_id
  WHERE ${onlyAB ? `j.choice IN ('a','b')` : `1=1`}
  ORDER BY j.created_at
`;

function rows(onlyAB: boolean): JudgedRow[] {
  return db.prepare(judgedQuery(onlyAB)).all() as JudgedRow[];
}

function chosenRejected(r: JudgedRow): { chosen: string; rejected: string } {
  return r.choice === 'a'
    ? { chosen: r.option_a, rejected: r.option_b }
    : { chosen: r.option_b, rejected: r.option_a };
}

// ── (a) DPO / RLHF JSONL ────────────────────────────────────────────
export function buildDpoJsonl(): { jsonl: string; count: number } {
  const lines = rows(true).map((r) => {
    const { chosen, rejected } = chosenRejected(r);
    return JSON.stringify({
      prompt: r.context,
      chosen,
      rejected,
      meta: {
        pair_id: r.pair_id,
        theme: r.theme_id,
        axis: r.axis,
        source_type: r.source_type,
        source_ref: r.source_ref,
        note: r.note,
        schema_version: 1,
      },
    });
  });
  return { jsonl: lines.join('\n') + (lines.length ? '\n' : ''), count: lines.length };
}

// ── (b) portable preference records (matches preference-record.v1.json) ──
function parseMeta(j: string | null) {
  if (!j) return undefined;
  try { return JSON.parse(j); } catch { return undefined; }
}

export function buildRecords(): PreferenceRecord[] {
  return rows(false).map((r) => ({
    id: r.pair_id,
    schema_version: 1,
    context: r.context,
    content_type: r.content_type as PreferenceRecord['content_type'],
    axis: r.axis,
    options: {
      a: { content: r.option_a, meta: parseMeta(r.a_meta_json) },
      b: { content: r.option_b, meta: parseMeta(r.b_meta_json) },
    },
    theme: r.theme_id
      ? { id: r.theme_id, label: r.theme_label ?? r.theme_id, kind: (r.theme_kind ?? 'custom') as any }
      : null,
    provenance: {
      source_type: r.source_type as PreferenceRecord['provenance']['source_type'],
      source_ref: r.source_ref,
      generator: r.provider
        ? { provider: r.provider as any, model: r.model, prompt_id: r.prompt_id }
        : null,
      generation_strength: r.strength,
    },
    judgment: {
      choice: r.choice,
      note: r.note,
      latency_ms: r.latency_ms,
      session_id: r.session_id,
      created_at: r.judged_at,
    },
    tags: [],
  }));
}

// ── (c) LLM-judge taste rubric ──────────────────────────────────────
const MIN_THEME_N = 1; // surface a theme once it has at least this many a/b judgments

export function buildRubric(name = 'this person'): { markdown: string; json: object } {
  const data = rows(true);
  const byTheme = new Map<string, JudgedRow[]>();
  for (const r of data) {
    const key = r.theme_label ?? 'General';
    (byTheme.get(key) ?? byTheme.set(key, []).get(key)!).push(r);
  }

  const themeBlocks: Array<{ theme: string; n: number; exemplars: any[] }> = [];
  for (const [theme, rs] of byTheme) {
    if (rs.length < MIN_THEME_N) continue;
    const exemplars = rs.slice(0, 8).map((r) => {
      const { chosen, rejected } = chosenRejected(r);
      return { context: r.context, axis: r.axis, chosen, rejected, note: r.note };
    });
    themeBlocks.push({ theme, n: rs.length, exemplars });
  }
  themeBlocks.sort((a, b) => b.n - a.n);

  // ── markdown system prompt ──
  const md: string[] = [];
  md.push(`# Taste rubric for ${name}`);
  md.push('');
  md.push(`You are ranking or judging artifacts to match ${name}'s personal taste. ` +
    `Below are their revealed preferences — real A/B choices they made, grouped by theme. ` +
    `When comparing candidates, prefer the one whose qualities align with the patterns below. ` +
    `These are matters of taste, not correctness.`);
  md.push('');
  md.push(`_Synthesized from ${data.length} A/B judgments across ${themeBlocks.length} themes. ` +
    `Low-sample themes are weaker signal — weight by count._`);
  md.push('');
  for (const b of themeBlocks) {
    md.push(`## ${b.theme}  _(n=${b.n})_`);
    for (const e of b.exemplars) {
      md.push(`- On *${e.context}* — prefers **“${e.chosen}”** over “${e.rejected}”` +
        (e.axis ? ` _(${e.axis})_` : '') + (e.note ? `\n  - their reason: “${e.note}”` : ''));
    }
    md.push('');
  }
  md.push(`## How to apply`);
  md.push(`1. Identify which themes a candidate touches. 2. For each, score how well it ` +
    `matches the revealed preferences above (weight by n). 3. Prefer the candidate with the ` +
    `higher weighted match. When the data is silent, say so rather than guessing.`);

  return {
    markdown: md.join('\n') + '\n',
    json: { name, total_judgments: data.length, themes: themeBlocks, generated_from_schema: 1 },
  };
}
