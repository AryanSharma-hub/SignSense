/**
 * Fingerspelling handshapes: one row per letter (A-Z) and digit (0-9), family
 * 'fingerspell-letter' / 'fingerspell-digit' — deliberately distinct from H11's
 * `family: 'letter'` (a regular gesture's letter-shaped handshape, e.g. WATER's "W";
 * that one must never be pulled into a spell-mode picker, and vice versa).
 *
 * Geometry here is placeholder/arbitrary (draft scaffold, needs_review defaults true
 * like everything else) — real ASL fingerspelling handshapes need an ASL-fluent
 * reviewer, same as the rest of the vocabulary. The point of this table is the
 * *mechanism* (a dedicated hand per letter/digit, addressable by id for the spelling
 * pipeline), not photographic accuracy.
 */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DIGITS = '0123456789'.split('');

function letterShape(i, n) {
  const t = i / n;
  return {
    curl: [
      Math.round((0.2 + 0.6 * ((i * 0.31) % 1)) * 100) / 100,
      Math.round((0.15 + 0.7 * ((i * 0.47) % 1)) * 100) / 100,
      Math.round((0.15 + 0.7 * ((i * 0.53) % 1)) * 100) / 100,
      Math.round((0.15 + 0.7 * ((i * 0.59) % 1)) * 100) / 100,
      Math.round((0.15 + 0.7 * ((i * 0.67) % 1)) * 100) / 100,
    ],
    spread: Math.round((0.1 + 0.5 * t) * 100) / 100,
  };
}

export const fingerspellHands = [
  ...LETTERS.map((ch, i) => ({
    id: `HL${ch}`, // HLA..HLZ
    label: `Letter ${ch}`, family: 'fingerspell-letter', shape: letterShape(i, LETTERS.length),
  })),
  ...DIGITS.map((d, i) => ({
    id: `HN${d}`, label: `Number ${d}`, family: 'fingerspell-digit', shape: letterShape(i + 3, DIGITS.length),
  })),
];

/** id for a letter ('A'→'HLA') or digit ('3'→'HN3'), or null if not spellable. */
export function fingerspellId(ch) {
  const c = ch.toUpperCase();
  if (/^[A-Z]$/.test(c)) return `HL${c}`;
  if (/^[0-9]$/.test(c)) return `HN${c}`;
  return null;
}
