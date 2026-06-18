// Import the curated public-domain image collection (app/public/images/
// manifest.json) as Visual-region A/B pairs. Pairs images within a category so
// the choice is about aesthetic pull, not medium. Run: npm run import:images
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { getDb, migrate } from '../../server/db.js';
import { ingestPairs } from '../protocol.js';
import type { GeneratedPairLine } from '../../shared/types.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = resolve(ROOT, 'app/public/images/manifest.json');

interface Item {
  file: string; title: string; artist: string; date: string;
  category: string; source: string; url: string;
}

const db = getDb();
migrate(db);

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Item[];

// one Visual theme per category (kind 'visual' → Visual region)
const CATEGORY_LABEL: Record<string, string> = {
  painting: 'Painting', photograph: 'Photography', print: 'Prints', drawing: 'Drawings',
  architecture: 'Architecture', landscape: 'Landscape', street: 'Street', portrait: 'Portrait',
  minimal: 'Minimalism', abstract: 'Abstract', interior: 'Interiors', food: 'Food',
  wildlife: 'Wildlife', 'still-life': 'Still life',
};
const upsertTheme = db.prepare(`INSERT OR IGNORE INTO themes (id, label, kind, description, sort_order) VALUES (?, ?, 'visual', ?, ?)`);

const byCat = new Map<string, Item[]>();
for (const m of manifest) (byCat.get(m.category) ?? byCat.set(m.category, []).get(m.category)!).push(m);

const lines: GeneratedPairLine[] = [];
let order = 20;
for (const [cat, items] of byCat) {
  const themeId = `art-${cat}`;
  upsertTheme.run(themeId, CATEGORY_LABEL[cat] ?? cat, `Which ${cat} draws you in?`, order++);
  // pair consecutive items within the category
  for (let i = 0; i + 1 < items.length; i += 2) {
    const a = items[i];
    const b = items[i + 1];
    lines.push({
      seed_id: `seed_img_${nanoid(10)}`,
      source_type: 'manual',
      source_ref: null,
      theme_id: themeId,
      context: 'Which draws you in?',
      content_type: 'image_ref',
      option_a: `/images/${a.file}`,
      option_b: `/images/${b.file}`,
      a_meta: { alt: a.title, title: a.title, artist: a.artist, source: a.source, url: a.url },
      b_meta: { alt: b.title, title: b.title, artist: b.artist, source: b.source, url: b.url },
      axis: 'aesthetic pull',
      provider: 'manual',
      model: null,
      prompt_id: 'visual_pick_v1',
    });
  }
}

const res = ingestPairs(lines, 'visual-import');
console.log(`✓ Built ${lines.length} visual pair(s) across ${byCat.size} categories; ingested ${res.inserted} new.`);
