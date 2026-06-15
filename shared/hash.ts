import { createHash } from 'node:crypto';

/** Normalize a string for dedup: trim, lowercase, collapse whitespace. */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Stable content hash for a pair. The two options are sorted before hashing
 * so an A/B-swapped duplicate collides with the original.
 */
export function pairContentHash(context: string, optionA: string, optionB: string): string {
  const [x, y] = [normalize(optionA), normalize(optionB)].sort();
  const basis = `${normalize(context)}${x}${y}`;
  return createHash('sha256').update(basis).digest('hex');
}
