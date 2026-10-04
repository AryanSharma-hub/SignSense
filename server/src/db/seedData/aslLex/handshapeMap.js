/**
 * Translates ASL-LEX 2.0's 58 standard handshape category names (real ASL chirology —
 * see ATTRIBUTION.md) into this app's own rendering parameters: shape.curl
 * [thumb,index,middle,ring,pinky] (0=extended..1=fully curled), spread (0..1), and an
 * optional thumbAngle. This translation is new, best-effort work for this project (ASL-LEX
 * itself doesn't specify curl arrays) — a human ASL-fluent reviewer should still check it,
 * same as every other row in the dataset.
 *
 * Ids are prefixed HX_ so they never collide with the existing H01-H35 (hand-authored +
 * placeholder growth) or HLA-HLZ/HN0-HN9 (fingerspelling) hand ids.
 */
const DEF = {
  '1': { label: '1 (index extended)', curl: [0.8, 0, 1, 1, 1], spread: 0 },
  '3': { label: '3 (thumb-index-middle)', curl: [0, 0, 0, 1, 1], spread: 0.3 },
  '4': { label: '4 (four fingers)', curl: [1, 0, 0, 0, 0], spread: 0.6 },
  '5': { label: '5 (open hand)', curl: [0, 0, 0, 0, 0], spread: 0.85 },
  '7': { label: '7 (thumb-ring)', curl: [0.3, 0, 0, 0.6, 0], spread: 0.3 },
  '8': { label: '8 (thumb-middle)', curl: [0.3, 0, 0.6, 0, 0], spread: 0.3 },
  a: { label: 'A (fist, thumb alongside)', curl: [0.2, 1, 1, 1, 1], spread: 0, thumbAngle: -15 },
  baby_o: { label: 'Baby O', curl: [0.5, 0.6, 0.6, 0.6, 0.6], spread: 0.1 },
  bent_1: { label: 'Bent 1', curl: [0.8, 0.6, 1, 1, 1], spread: 0 },
  bent_l: { label: 'Bent L', curl: [0, 0.5, 1, 1, 1], spread: 0.3, thumbAngle: -70 },
  bent_v: { label: 'Bent V', curl: [1, 0.5, 0.5, 1, 1], spread: 0.5 },
  c: { label: 'C (curved)', curl: [0.4, 0.4, 0.4, 0.4, 0.4], spread: 0.15, thumbAngle: -40 },
  closed_b: { label: 'Closed B', curl: [0.85, 0, 0, 0, 0], spread: 0 },
  closed_e: { label: 'Closed E (claw, shut)', curl: [1, 1, 1, 1, 1], spread: 0 },
  curved_1: { label: 'Curved 1', curl: [0.5, 0.3, 1, 1, 1], spread: 0 },
  curved_4: { label: 'Curved 4', curl: [0.9, 0.25, 0.25, 0.25, 0.25], spread: 0.4 },
  curved_5: { label: 'Curved 5', curl: [0.25, 0.3, 0.3, 0.3, 0.35], spread: 0.3 },
  curved_h: { label: 'Curved H', curl: [0.9, 0.3, 0.3, 1, 1], spread: 0 },
  curved_l: { label: 'Curved L', curl: [0.3, 0.3, 1, 1, 1], spread: 0.3, thumbAngle: -60 },
  curved_v: { label: 'Curved V', curl: [1, 0.3, 0.3, 1, 1], spread: 0.4 },
  d: { label: 'D', curl: [0.5, 0, 1, 1, 1], spread: 0, thumbAngle: -30 },
  e: { label: 'E (claw)', curl: [0.7, 0.7, 0.7, 0.7, 0.7], spread: 0 },
  f: { label: 'F (OK sign)', curl: [0.6, 0.6, 0, 0, 0], spread: 0.3 },
  flat_1: { label: 'Flat 1', curl: [0.8, 0, 1, 1, 1], spread: 0 },
  flat_4: { label: 'Flat 4', curl: [0.9, 0, 0, 0, 0], spread: 0.05 },
  flat_b: { label: 'Flat B (open palm)', curl: [0.25, 0, 0, 0, 0], spread: 0 },
  flat_h: { label: 'Flat H', curl: [0.9, 0, 0, 1, 1], spread: 0 },
  flat_horns: { label: 'Flat Horns', curl: [0, 0, 1, 1, 0], spread: 0.5 },
  flat_ily: { label: 'Flat ILY', curl: [0, 0, 1, 1, 0], spread: 0.4 },
  flat_m: { label: 'Flat M', curl: [0.9, 0.8, 0.8, 0.8, 1], spread: 0 },
  flat_n: { label: 'Flat N', curl: [0.9, 0.8, 0.8, 0.2, 1], spread: 0 },
  flat_o: { label: 'Flat O', curl: [0.5, 0.7, 0.7, 0.7, 0.7], spread: 0 },
  flat_v: { label: 'Flat V', curl: [0.9, 0, 0, 1, 1], spread: 0.5 },
  flatspread_5: { label: 'Flat spread 5', curl: [0, 0, 0, 0, 0], spread: 1 },
  g: { label: 'G (point sideways)', curl: [0, 0, 1, 1, 1], spread: 0, thumbAngle: -80 },
  goody_goody: { label: 'Goody-goody (bent claw)', curl: [0.6, 0.6, 0.6, 0.6, 0.6], spread: 0.4 },
  h: { label: 'H', curl: [0.9, 0, 0, 1, 1], spread: 0 },
  horns: { label: 'Horns', curl: [0, 0, 1, 1, 0], spread: 0.5 },
  i: { label: 'I (pinky extended)', curl: [0.8, 1, 1, 1, 0], spread: 0 },
  ily: { label: 'I Love You', curl: [0, 0, 1, 1, 0], spread: 0.45 },
  k: { label: 'K', curl: [0.4, 0, 0, 1, 1], spread: 0.4, thumbAngle: -50 },
  l: { label: 'L', curl: [0, 0, 1, 1, 1], spread: 0.3, thumbAngle: -75 },
  o: { label: 'O (circle)', curl: [0.5, 0.6, 0.6, 0.6, 0.6], spread: 0.05 },
  open_8: { label: 'Open 8', curl: [0.3, 0, 0.5, 0, 0], spread: 0.3 },
  open_b: { label: 'Open B (relaxed palm)', curl: [0.05, 0, 0, 0, 0], spread: 0.5 },
  open_e: { label: 'Open E', curl: [0.5, 0.5, 0.5, 0.5, 0.5], spread: 0.2 },
  open_f: { label: 'Open F', curl: [0.5, 0.5, 0, 0, 0], spread: 0.4 },
  open_h: { label: 'Open H', curl: [0.9, 0, 0.1, 1, 1], spread: 0.3 },
  p: { label: 'P', curl: [0.4, 0, 0, 1, 1], spread: 0.4, thumbAngle: -50 },
  r: { label: 'R (crossed fingers)', curl: [0.9, 0.1, 0.1, 1, 1], spread: 0 },
  s: { label: 'S (fist)', curl: [0.6, 1, 1, 1, 1], spread: 0 },
  spread_e: { label: 'Spread E', curl: [0.6, 0.6, 0.6, 0.6, 0.6], spread: 0.6 },
  spread_open_e: { label: 'Spread Open E', curl: [0.45, 0.45, 0.45, 0.45, 0.45], spread: 0.7 },
  stacked_5: { label: 'Stacked 5', curl: [0.3, 0.3, 0.3, 0.3, 0.3], spread: 0 },
  t: { label: 'T', curl: [0.5, 1, 1, 1, 1], spread: 0, thumbAngle: 10 },
  v: { label: 'V (peace)', curl: [0.9, 0, 0, 1, 1], spread: 0.6 },
  w: { label: 'W', curl: [0.9, 0, 0, 0, 1], spread: 0.5 },
  y: { label: 'Y (hang loose)', curl: [0, 1, 1, 1, 0], spread: 0.6, thumbAngle: -70 },
};

export const ASL_LEX_HANDSHAPES = Object.fromEntries(
  Object.entries(DEF).map(([code, { label, curl, spread, thumbAngle }]) => [
    code,
    { id: `HX_${code.toUpperCase()}`, label, family: 'asl-lex', shape: { curl, spread, ...(thumbAngle != null ? { thumbAngle } : {}) } },
  ]),
);

/** All 58 handshape rows, ready to append to the `hands` vocab table. */
export const aslLexHandRows = Object.values(ASL_LEX_HANDSHAPES);

/** ASL-LEX code (lowercase, e.g. "curved_5") -> this app's hand id, or null for NA/unset. */
export function handshapeIdFor(code) {
  const c = String(code || '').trim().toLowerCase();
  if (!c || c === 'na' || c === 'dominanceconditionviolation') return null;
  return ASL_LEX_HANDSHAPES[c]?.id ?? null;
}
