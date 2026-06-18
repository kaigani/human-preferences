import { nanoid } from 'nanoid';
import { getDb } from '../../server/db.js';
import type { SeedLine, Theme } from '../../shared/types.js';

const db = getDb();

/**
 * Generic seeds for prompt-driven generation (role-play, morality, narrative…):
 * one seed per unit of work, cycling through `axes` as hints. The runner's
 * chosen prompt template expands each into `pairsPerSeed` pairs.
 */
export function promptSeeds(
  themeId: string,
  count: number,
  pairsPerSeed: number,
  axes: string[],
): SeedLine[] {
  const theme = db.prepare(`SELECT * FROM themes WHERE id = ?`).get(themeId) as Theme | undefined;
  if (!theme) throw new Error(`unknown theme: ${themeId}`);
  const seeds: SeedLine[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push({
      seed_id: `seed_${nanoid(12)}`,
      source_type: 'theme',
      source_ref: null,
      theme_id: theme.id,
      theme_label: theme.label,
      context: theme.description ?? theme.label,
      axis_hint: axes.length ? axes[i % axes.length] : undefined,
      pairs_per_seed: pairsPerSeed,
    });
  }
  return seeds;
}
