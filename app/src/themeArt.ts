// Topic color as a CLASSIFICATION MARK (stripe + dot), never a card wash.
// Strong, non-pastel secondary colors mapped per theme.
export const THEME_COLOR: Record<string, string> = {
  design: 'var(--color-topic-design)',   // electric cobalt
  living: 'var(--color-topic-living)',   // teal
  power: 'var(--color-topic-society)',   // raspberry
  culture: 'var(--color-topic-culture)', // violet
  'current-events': 'var(--color-topic-work)', // orange (the live topic)
};

export function artFor(id: string): string {
  return THEME_COLOR[id] ?? 'var(--color-topic-ethics)'; // steel for SHP/other
}
