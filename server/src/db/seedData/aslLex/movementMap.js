/**
 * Translates ASL-LEX 2.0's Movement.2.0 (path shape) x RepeatedMovement.2.0 (0/1) into
 * this app's movement vocab. ASL-LEX records the SHAPE of the movement, not a spatial
 * direction the way this app's `dir` (compass) does — there's no "forward" vs "up" in the
 * source data, so every shape gets one reasonable, fixed direction/family. "None" (no
 * path movement at all) intentionally produces no row — those signs just don't set M.
 */
const SHAPES = {
  Straight: { dir: 'N', family: 'straight' },
  Curved: { dir: 'NE', family: 'arc' },
  Circular: { dir: 'PATTERN', family: 'circular' },
  BackAndForth: { dir: 'S', family: 'lateral' },
  'Z-shaped': { dir: 'PATTERN', family: 'pattern' },
  'X-shaped': { dir: 'PATTERN', family: 'pattern' },
  Other: { dir: 'PATTERN', family: 'pattern' },
};

export const aslLexMovementRows = Object.entries(SHAPES).flatMap(([shape, { dir, family }]) => {
  const base = { id: `MX_${shape.replace(/[^A-Za-z]/g, '').toUpperCase()}`, label: shape, dir, family };
  const repeated = { id: `${base.id}_REP`, label: `${shape} (repeated)`, dir, family: 'repeat' };
  return [base, repeated];
});

const BY_KEY = new Map(aslLexMovementRows.map((m) => [m.id, m]));

/** Movement.2.0 shape + RepeatedMovement.2.0 (0/1/"0"/"1") -> this app's movement id, or null for "None". */
export function movementIdFor(shape, repeated) {
  const s = String(shape || '').trim();
  if (!s || s === 'None') return null;
  const key = `MX_${s.replace(/[^A-Za-z]/g, '').toUpperCase()}`;
  const rep = String(repeated) === '1';
  const id = rep ? `${key}_REP` : key;
  return BY_KEY.has(id) ? id : (BY_KEY.has(key) ? key : null);
}
