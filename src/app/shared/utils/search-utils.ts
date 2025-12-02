/**
 * Normalize a string for search comparisons: lowercase and strip diacritics.
 * @param s Input value (coerced to string)
 * @returns Normalized ASCII-like string without diacritics
 */
export function normalizeString(s: any): string {
  const str = String(s ?? '').toLowerCase();
  try {
    return str.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  } catch {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
}

/**
 * Case-insensitive, diacritic-insensitive substring match.
 * @param hay Text to search within
 * @param q Query string
 * @returns True if normalized hay contains normalized query
 */
export function stringMatches(hay: any, q: string): boolean {
  if (!q) return true;
  const H = normalizeString(hay);
  const Q = normalizeString(q);
  return H.includes(Q);
}
