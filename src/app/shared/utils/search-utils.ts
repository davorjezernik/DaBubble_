export function normalizeString(s: any): string {
  const str = String(s ?? '').toLowerCase();
  try {
    return str.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  } catch {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
}

export function stringMatches(hay: any, q: string): boolean {
  if (!q) return true;
  const H = normalizeString(hay);
  const Q = normalizeString(q);
  return H.includes(Q);
}
