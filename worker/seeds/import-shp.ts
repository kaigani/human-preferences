// Import SHP as a SEED/TOPIC corpus (not pre-made pairs). Each Reddit post's
// `history` becomes a context; its `domain` becomes an shp_domain theme. The
// runner later expands each seed into opinionated A/B stances.
//
// Usage: npm run import:shp -- [--limit 500] [--offset 0] [--max-history 1200]
import { nanoid } from 'nanoid';
import { getDb, migrate } from '../../server/db.js';

const db = getDb();
migrate(db);

function flags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] ?? 'true';
  }
  return out;
}
const f = flags(process.argv.slice(2));
const LIMIT = Number(f.limit ?? 500);
const START = Number(f.offset ?? 0);
const MAX_HISTORY = Number(f['max-history'] ?? 1200);
const PAGE = 100;

const DATASET = 'stanfordnlp/SHP';
const BASE = 'https://datasets-server.huggingface.co/rows';

/** "askacademia_train" → "askacademia"; pretty label for display. */
function cleanDomain(domain: string): { id: string; label: string } {
  const slug = domain.replace(/_(train|validation|test)$/i, '');
  const label = slug.replace(/^ask/, 'ask ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  return { id: `shp:${slug}`, label };
}

const upsertTheme = db.prepare(`INSERT OR IGNORE INTO themes (id, label, kind, description) VALUES (?, ?, 'shp_domain', ?)`);
const insertSeed = db.prepare(`
  INSERT OR IGNORE INTO seeds (id, source_type, source_ref, theme_id, context, payload_json)
  VALUES (@id, 'shp', @source_ref, @theme_id, @context, @payload_json)
`);

async function fetchPage(offset: number, length: number): Promise<any[]> {
  const url = `${BASE}?dataset=${encodeURIComponent(DATASET)}&config=default&split=train&offset=${offset}&length=${length}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HF datasets-server ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { rows: Array<{ row: any }> };
  return data.rows.map((r) => r.row);
}

const ingestPage = db.transaction((rows: any[]) => {
  let seeds = 0;
  const themes = new Set<string>();
  for (const row of rows) {
    const { id: themeId, label } = cleanDomain(String(row.domain ?? 'misc'));
    upsertTheme.run(themeId, label, `Reddit r/${label} — preferences mined as taste seeds.`);
    themes.add(themeId);
    const history = String(row.history ?? '').slice(0, MAX_HISTORY);
    if (!history.trim()) continue;
    const info = insertSeed.run({
      id: `seed_${nanoid(12)}`,
      source_ref: String(row.post_id),
      theme_id: themeId,
      context: history,
      payload_json: JSON.stringify(row),
    });
    seeds += info.changes;
  }
  return { seeds, themes: themes.size };
});

async function totalRows(): Promise<number> {
  const url = `${BASE}?dataset=${encodeURIComponent(DATASET)}&config=default&split=train&offset=0&length=1`;
  const res = await fetch(url);
  const data = (await res.json()) as { num_rows_total: number };
  return data.num_rows_total ?? 0;
}

(async () => {
  const SPREAD = 'spread' in f;
  let offsets: number[];
  if (SPREAD) {
    // sample evenly across the whole dataset so all 18 domains are represented
    const total = await totalRows();
    const pages = Math.ceil(LIMIT / PAGE);
    const step = Math.max(PAGE, Math.floor(total / pages));
    offsets = Array.from({ length: pages }, (_, i) => i * step);
    console.log(`Spread-importing ~${LIMIT} SHP rows across ${pages} points of ${total} total…`);
  } else {
    offsets = [];
    for (let off = START; off < START + LIMIT; off += PAGE) offsets.push(off);
    console.log(`Importing ${LIMIT} SHP rows from offset ${START} as seeds…`);
  }

  let imported = 0;
  for (const off of offsets) {
    let rows: any[];
    try {
      rows = await fetchPage(off, PAGE);
    } catch (e) {
      process.stdout.write(`  offset ${off}: fetch failed (${(e as Error).message.slice(0, 40)}), skipping\n`);
      continue;
    }
    if (!rows.length) continue;
    const { seeds } = ingestPage(rows);
    imported += seeds;
    process.stdout.write(`  offset ${off}: +${seeds} seed(s)        \r`);
  }
  const totalSeeds = (db.prepare(`SELECT COUNT(*) n FROM seeds WHERE source_type='shp'`).get() as { n: number }).n;
  const totalThemes = (db.prepare(`SELECT COUNT(*) n FROM themes WHERE kind='shp_domain'`).get() as { n: number }).n;
  console.log(`\n✓ Imported ${imported} new SHP seed(s). Corpus now: ${totalSeeds} seeds across ${totalThemes} SHP domains.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
