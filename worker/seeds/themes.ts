import { nanoid } from 'nanoid';
import { getDb } from '../../server/db.js';
import type { SeedLine, Theme } from '../../shared/types.js';

// Each theme is broken into distinct FACETS — a specific angle + its contrast
// axis — so every seed explores different ground instead of recycling one
// context. This is the main lever against redundant, near-identical pairs.
interface Facet {
  context: string;
  axis: string;
}

const FACETS: Record<string, Facet[]> = {
  design: [
    { context: 'Choosing a typeface for a long-form reading experience', axis: 'warm humanist vs engineered geometric' },
    { context: 'How an interface should treat color', axis: 'restraint vs saturation' },
    { context: 'The role of whitespace and density', axis: 'air vs density' },
    { context: 'How a product reveals its depth on first use', axis: 'obvious vs discoverable' },
    { context: 'The place of motion and animation', axis: 'still vs kinetic' },
    { context: 'How to handle an error or failure state', axis: 'honest vs gentle' },
    { context: 'Defaults versus customization', axis: 'opinionated vs flexible' },
    { context: 'Photography versus illustration for imagery', axis: 'real vs drawn' },
    { context: 'How dense a data table should be', axis: 'comfortable vs compact' },
    { context: 'Borders versus shadows for separation', axis: 'flat vs layered' },
    { context: 'The personality of an icon set', axis: 'literal vs distinctive' },
    { context: 'What an empty state should feel like', axis: 'utilitarian vs inviting' },
    { context: 'Sound and haptics in an interface', axis: 'silent vs expressive' },
    { context: 'How ornament earns its place', axis: 'reduction vs decoration' },
    { context: 'The texture and materiality of a surface', axis: 'matte-flat vs tactile-rich' },
  ],
  living: [
    { context: 'How to spend a free morning', axis: 'slow vs productive' },
    { context: 'What a home should hold', axis: 'few-fine vs collected-many' },
    { context: 'How to cook a meal', axis: 'precise recipe vs intuitive improvisation' },
    { context: 'Where to live', axis: 'dense city vs open nature' },
    { context: 'How to travel', axis: 'one place deeply vs many places broadly' },
    { context: 'Saving versus spending on experiences', axis: 'security vs experience' },
    { context: 'The shape of a week', axis: 'steady routine vs variety' },
    { context: 'A good gathering with people', axis: 'intimate few vs lively many' },
    { context: 'Relationship to devices at home', axis: 'connected vs unplugged' },
    { context: 'How to own things', axis: 'minimal vs abundant' },
    { context: 'Rest and leisure', axis: 'idle vs active' },
    { context: 'Hosting others', axis: 'effortless-casual vs considered-formal' },
    { context: 'How to handle a free evening alone', axis: 'solitude vs company' },
    { context: 'Daily ritual and habit', axis: 'disciplined vs spontaneous' },
    { context: 'What luxury means day to day', axis: 'time vs things' },
  ],
  power: [
    { context: 'How a leader should hold authority', axis: 'visible vs invisible' },
    { context: 'What status is worth signaling', axis: 'loud vs quiet' },
    { context: 'When to reform an institution versus protect it', axis: 'reform vs preserve' },
    { context: 'How ambition should shape a life', axis: 'driven vs content' },
    { context: 'How to negotiate from a position of strength', axis: 'competitive vs cooperative' },
    { context: 'Who takes the blame when things fail', axis: 'own it vs fix the system' },
    { context: 'How much risk a leader should accept', axis: 'bold vs steady' },
    { context: 'How power should pass to the next person', axis: 'groomed succession vs open contest' },
    { context: 'What earns loyalty', axis: 'merit vs allegiance' },
    { context: 'How money and influence should mix', axis: 'separate vs intertwined' },
    { context: 'When to show mercy versus hold the line', axis: 'mercy vs firmness' },
    { context: 'How much to delegate versus control', axis: 'release vs grip' },
    { context: 'What a leader owes the public eye', axis: 'transparency vs discretion' },
    { context: 'How to handle dissent', axis: 'tolerate vs suppress' },
    { context: 'How a decision should be made', axis: 'decisive vs consensus' },
  ],
  culture: [
    { context: 'What art should do for us', axis: 'comfort vs provoke' },
    { context: 'The weight of the canon and tradition', axis: 'tradition vs reinvention' },
    { context: 'What makes a great story', axis: 'plot vs character' },
    { context: 'High culture versus popular culture', axis: 'refined vs vital' },
    { context: 'How to judge taste itself', axis: 'universal standard vs personal' },
    { context: 'How a story should end', axis: 'resolved vs open' },
    { context: 'The right pace for a film', axis: 'patient vs propulsive' },
    { context: 'Sincerity versus irony', axis: 'earnest vs ironic' },
    { context: 'Originality versus craft', axis: 'new vs well-made' },
    { context: 'The point of criticism', axis: 'celebrate vs scrutinize' },
    { context: 'Difficulty and accessibility in art', axis: 'welcoming vs demanding' },
    { context: 'Preserving versus remixing culture', axis: 'archive vs remix' },
    { context: 'The role of beauty', axis: 'beauty vs truth' },
    { context: 'Nostalgia versus the new', axis: 'nostalgic vs forward' },
    { context: 'When art should provoke discomfort', axis: 'console vs unsettle' },
  ],
};

const db = getDb();

/** Build seed lines for a theme from distinct facets (no recycled context). */
export function themeSeeds(themeId: string, count: number, pairsPerSeed: number): SeedLine[] {
  const theme = db.prepare(`SELECT * FROM themes WHERE id = ?`).get(themeId) as Theme | undefined;
  if (!theme) throw new Error(`unknown theme: ${themeId}`);
  const facets = FACETS[themeId];
  if (!facets) throw new Error(`no facets defined for theme: ${themeId}`);

  const seeds: SeedLine[] = [];
  for (let i = 0; i < count; i++) {
    const facet = facets[i % facets.length];
    // if more seeds than facets are requested, later passes nudge a fresh angle
    const lap = Math.floor(i / facets.length);
    const context = lap === 0 ? facet.context : `${facet.context} (a different angle than before)`;
    seeds.push({
      seed_id: `seed_${nanoid(12)}`,
      source_type: 'theme',
      source_ref: null,
      theme_id: theme.id,
      theme_label: theme.label,
      context: `${context} — a matter of personal taste in ${theme.label.toLowerCase()}.`,
      axis_hint: facet.axis,
      pairs_per_seed: pairsPerSeed,
    });
  }
  return seeds;
}
