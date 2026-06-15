// Write the LLM-judge taste rubric. Usage: npm run export:rubric
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import 'dotenv/config';
import { getDb, migrate } from '../server/db.js';
import { buildRubric } from './build.js';

migrate(getDb());
const outDir = resolve('exports');
mkdirSync(outDir, { recursive: true });

const name = process.env.USER_DISPLAY_NAME ?? 'this person';
const { markdown, json } = buildRubric(name);

const mdPath = resolve(outDir, 'taste-rubric.md');
const jsonPath = resolve(outDir, 'taste-rubric.json');
writeFileSync(mdPath, markdown, 'utf8');
writeFileSync(jsonPath, JSON.stringify(json, null, 2), 'utf8');

console.log(`✓ Taste rubric → ${mdPath}`);
console.log(`✓ Rubric data  → ${jsonPath}`);
