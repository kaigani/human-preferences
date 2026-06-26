// Memory salience — A/B-rank the user's OWN life events to find which memories
// are load-bearing. This bridges the (private) biography layer to the preference
// engine. The pairs reference private biographical content, so they are kept in
// the 'memory' theme and EXCLUDED from the shareable preference exports.
import { nanoid } from 'nanoid';
import { getDb } from './db.js';
import { pairContentHash } from '../shared/hash.js';
import type { LifeEvent } from '../shared/life.js';

const db = getDb();

const MEMORY_THEME = 'memory-salience';
const ensureTheme = db.prepare(
  `INSERT OR IGNORE INTO themes (id, label, kind, description, sort_order)
   VALUES (?, 'What shaped you', 'memory', 'Which memory shaped you more?', 15)`,
);

const insertPair = db.prepare(`
  INSERT OR IGNORE INTO pairs
    (id, schema_version, seed_id, theme_id, context, content_type,
     option_a, option_b, a_meta_json, b_meta_json, generator_provider,
     generator_prompt_id, axis, content_hash, status)
  VALUES
    (?, 1, NULL, ?, 'Which shaped you more?', 'text',
     ?, ?, ?, ?, 'self', 'memory_salience_v1', 'autobiographical salience',
     ?, 'queued')
`);

function label(e: LifeEvent): string {
  return e.date_start ? `${e.title} (${e.date_start})` : e.title;
}

/** Build A/B pairs across the user's life events. Caps work so large lists don't
 *  explode: each event is paired with up to `fanout` later events. Idempotent
 *  via content_hash. Returns how many new pairs were created. */
export function refreshMemoryPairs(fanout = 6): { events: number; created: number } {
  ensureTheme.run(MEMORY_THEME);
  const events = db
    .prepare(`SELECT * FROM life_events ORDER BY (date_start IS NULL), date_start, created_at`)
    .all() as LifeEvent[];
  if (events.length < 2) return { events: events.length, created: 0 };

  let created = 0;
  const tx = db.transaction(() => {
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j <= Math.min(i + fanout, events.length - 1); j++) {
        const a = events[i];
        const b = events[j];
        const hash = pairContentHash('which shaped you more', a.id, b.id);
        const info = insertPair.run(
          `pair_${nanoid(12)}`,
          MEMORY_THEME,
          label(a),
          label(b),
          JSON.stringify({ event_id: a.id, category: a.category }),
          JSON.stringify({ event_id: b.id, category: b.category }),
          hash,
        );
        created += info.changes;
      }
    }
  });
  tx();
  return { events: events.length, created };
}
