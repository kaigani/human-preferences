import { nanoid } from 'nanoid';
import { getDb } from '../../server/db.js';
import type { SeedLine, Theme } from '../../shared/types.js';

const db = getDb();

// A few contrast axes per theme to nudge the runner toward variety. The runner
// is free to choose its own axis; these are hints, one seeded per unit of work.
const AXIS_HINTS: Record<string, string[]> = {
  design: ['minimal vs ornate', 'obvious vs discoverable', 'warm vs cool', 'classic vs experimental', 'density vs air'],
  living: ['slow vs productive', 'rooted vs nomadic', 'few-fine vs many-useful', 'solitude vs company', 'routine vs spontaneity'],
  power: ['visible vs invisible authority', 'decisive vs consensus', 'reform vs preserve', 'bold vs steady', 'merit vs loyalty'],
  culture: ['comfort vs provoke', 'tradition vs reinvention', 'plot vs character', 'earnest vs ironic', 'accessible vs demanding'],
};

/** Build N seed lines for a theme; each seed asks the runner for `pairsPerSeed` pairs. */
export function themeSeeds(themeId: string, count: number, pairsPerSeed: number): SeedLine[] {
  const theme = db.prepare(`SELECT * FROM themes WHERE id = ?`).get(themeId) as Theme | undefined;
  if (!theme) throw new Error(`unknown theme: ${themeId}`);
  const hints = AXIS_HINTS[themeId] ?? [];
  const seeds: SeedLine[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push({
      seed_id: `seed_${nanoid(12)}`,
      source_type: 'theme',
      source_ref: null,
      theme_id: theme.id,
      theme_label: theme.label,
      context: `Personal taste in ${theme.label.toLowerCase()} — ${theme.description ?? ''}`.trim(),
      axis_hint: hints.length ? hints[i % hints.length] : undefined,
      pairs_per_seed: pairsPerSeed,
    });
  }
  return seeds;
}
