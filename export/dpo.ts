// Write the DPO/RLHF JSONL export. Usage: npm run export:dpo
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, migrate } from '../server/db.js';
import { buildDpoJsonl, buildRecords } from './build.js';

migrate(getDb());
const outDir = resolve('exports');
mkdirSync(outDir, { recursive: true });

const { jsonl, count } = buildDpoJsonl();
const dpoPath = resolve(outDir, 'dpo.jsonl');
writeFileSync(dpoPath, jsonl, 'utf8');

const records = buildRecords();
const recPath = resolve(outDir, 'preference-records.json');
writeFileSync(recPath, JSON.stringify({ schema_version: 1, records }, null, 2), 'utf8');

console.log(`✓ DPO export: ${count} pair(s) → ${dpoPath}`);
console.log(`✓ Portable records: ${records.length} → ${recPath}`);
if (count === 0) console.log('  (judge some pairs first — skip/no-preference are excluded from DPO)');
