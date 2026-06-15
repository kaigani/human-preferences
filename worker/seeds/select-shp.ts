import { getDb } from '../../server/db.js';
import type { SeedLine } from '../../shared/types.js';

const db = getDb();

/**
 * Pick SHP seeds not yet turned into pairs, optionally limited to one domain.
 * Round-robins across domains (one per domain, then the next per domain, …) so
 * a plain `--source shp` selection spans domains broadly instead of draining
 * them in import order.
 */
export function selectShpSeeds(limit: number, pairsPerSeed: number, themeId?: string): SeedLine[] {
  const rows = db
    .prepare(
      `SELECT id, source_ref, theme_id, theme_label, context FROM (
         SELECT s.id, s.source_ref, s.theme_id, t.label AS theme_label, s.context,
                ROW_NUMBER() OVER (PARTITION BY s.theme_id ORDER BY s.id) AS rn
         FROM seeds s
         JOIN themes t ON t.id = s.theme_id
         WHERE s.source_type = 'shp'
           AND (@theme IS NULL OR s.theme_id = @theme)
           AND NOT EXISTS (SELECT 1 FROM pairs p WHERE p.seed_id = s.id)
       )
       ORDER BY rn, theme_id
       LIMIT @limit`,
    )
    .all({ theme: themeId ?? null, limit }) as any[];

  return rows.map((r) => ({
    seed_id: r.id,
    source_type: 'shp' as const,
    source_ref: r.source_ref,
    theme_id: r.theme_id,
    theme_label: r.theme_label,
    context: r.context,
    pairs_per_seed: pairsPerSeed,
  }));
}
