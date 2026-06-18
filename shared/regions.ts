// The "Taste Map": preference regions, their fill thresholds, and the tier
// ladder. Pure logic shared by server (scoring) and app (display).

export interface Region {
  id: string;
  label: string;
}

// Ordered — this is the ledger order on the dashboard.
export const REGIONS: Region[] = [
  { id: 'ideas', label: 'Ideas & opinion' },
  { id: 'living', label: 'Daily life' },
  { id: 'work', label: 'Work & roles' },
  { id: 'morality', label: 'Right & wrong' },
  { id: 'power', label: 'Power & society' },
  { id: 'culture', label: 'Culture & meaning' },
  { id: 'narrative', label: 'Narrative' },
  { id: 'visual', label: 'Visual' },
  { id: 'now', label: 'The Now' },
];

// SHP domains that are practical-life rather than ideas.
const SHP_LIVING = new Set([
  'shp:askculinary', 'shp:askbaking', 'shp:askcarguys', 'shp:askdocs', 'shp:askhr', 'shp:legaladvice',
]);

/** Map a theme to its region. */
export function regionForTheme(themeId: string | null, kind: string | null): string {
  if (!themeId) return 'ideas';
  if (kind === 'current_events' || themeId === 'current-events') return 'now';
  if (kind === 'roleplay') return 'work';
  if (kind === 'moral') return 'morality';
  if (kind === 'narrative') return 'narrative';
  if (kind === 'visual') return 'visual';
  if (themeId === 'living') return 'living';
  if (themeId === 'power') return 'power';
  if (themeId === 'culture' || themeId === 'design') return 'culture';
  if (themeId.startsWith('shp:')) return SHP_LIVING.has(themeId) ? 'living' : 'ideas';
  return 'ideas';
}

// Per-region fill thresholds (judgments).
export const CALIBRATED_AT = 30;
export const RICH_AT = 120;

export type RegionState = 'unmapped' | 'sketch' | 'calibrated' | 'rich';

export function regionState(active: boolean, judged: number): RegionState {
  if (!active) return 'unmapped';
  if (judged >= RICH_AT) return 'rich';
  if (judged >= CALIBRATED_AT) return 'calibrated';
  return 'sketch';
}

// The tier ladder — each unlocks an export. Thresholds are honest guidelines.
export interface Tier {
  id: string;
  label: string;
  min: number;
  unlocks: string;
}

export const TIERS: Tier[] = [
  { id: 'sketch', label: 'Sketch', min: 0, unlocks: 'Building your map' },
  { id: 'calibrated', label: 'Calibrated', min: 1000, unlocks: 'LLM-judge rubric' },
  { id: 'proxy', label: 'Proxy-ready', min: 5000, unlocks: 'DPO fine-tune set' },
  { id: 'robust', label: 'Robust', min: 10000, unlocks: 'Strong cross-domain proxy' },
  { id: 'highfidelity', label: 'High-fidelity', min: 25000, unlocks: 'A nuanced proxy across every region' },
  { id: 'mirror', label: 'Mirror', min: 50000, unlocks: 'A proxy that reads as unmistakably you' },
  { id: 'mindfile', label: 'Mindfile', min: 100000, unlocks: 'The complete corpus — infinite you' },
];

export function tierForCount(n: number): { current: Tier; next: Tier | null; toNext: number } {
  let current = TIERS[0];
  for (const t of TIERS) if (n >= t.min) current = t;
  const idx = TIERS.indexOf(current);
  const next = TIERS[idx + 1] ?? null;
  return { current, next, toNext: next ? next.min - n : 0 };
}
