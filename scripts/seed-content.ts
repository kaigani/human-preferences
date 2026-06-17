// Seed the curated Narrative and Work-&-roles regions from seed-data/*.jsonl,
// creating the themes they need. Idempotent. Run: npm run seed:content
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, migrate } from '../server/db.js';
import { ingestPairs } from '../worker/protocol.js';
import type { GeneratedPairLine } from '../shared/types.js';

const db = getDb();
migrate(db);

const themes: Array<[string, string, string, string, number]> = [
  // id, label, kind, description, sort_order
  ['film', 'Film', 'narrative', 'Which film would you rather watch?', 10],
  ['television', 'Television', 'narrative', 'Which series would you rather sink into?', 11],
  ['books', 'Books', 'narrative', 'Which would you rather read?', 12],
  ['music', 'Music', 'narrative', 'Which would you rather listen to?', 13],
  ['games', 'Games', 'narrative', 'Which world would you rather enter?', 14],
  ['work-roles', 'Work & roles', 'roleplay', 'You are in a role, facing a call. What do you do?', 6],
];
const upsertTheme = db.prepare(
  `INSERT OR IGNORE INTO themes (id,label,kind,description,sort_order) VALUES (?,?,?,?,?)`,
);
for (const t of themes) upsertTheme.run(...t);

function ingest(file: string): number {
  const path = resolve('seed-data', file);
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as GeneratedPairLine);
  return ingestPairs(lines, `seed:${file}`).inserted;
}

const nr = ingest('narrative.jsonl');
const rp = ingest('roleplay.jsonl');
console.log(`✓ Seeded curated content: ${nr} narrative + ${rp} role-play pair(s).`);
