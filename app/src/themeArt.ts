// Editorial gradient "swatches" per theme — stands in for photography,
// keeping the palette warm and cohesive with the paper ground.
export const THEME_ART: Record<string, string> = {
  design: 'linear-gradient(135deg, #d7c9a8, #9a8f78)',
  living: 'linear-gradient(135deg, #cdd7c5, #8a9b86)',
  power: 'linear-gradient(135deg, #2c2a22, #6b6150)',
  culture: 'linear-gradient(135deg, #d9b8a0, #a9778f)',
};

export function artFor(id: string): string {
  return THEME_ART[id] ?? 'linear-gradient(135deg, var(--gold-soft), var(--ink-3))';
}
