import { byId } from './vocabulary.js';

/**
 * How a sign is made, in plain words, from its steps — the "how to sign it" notes shown
 * while learning. Uses only what the data records (hands, places, movement shape,
 * handshape changes); it never invents direction or palm orientation.
 * @returns {Array<{k:'H'|'L'|'M'|'E'|'HD', text:string}>}
 */
export function describeSign(signForm, vocab) {
  const out = [];
  const first = signForm?.[0];
  if (!first) return out;
  const label = (k, id) => byId(vocab, k, id)?.label;
  const r = label('H', first.H?.right), l = label('H', first.H?.left);
  if (r && l && first.H.right === first.H.left) out.push({ k: 'H', text: `Both hands: ${r}` });
  else {
    if (r) out.push({ k: 'H', text: `Dominant hand: ${r}` });
    if (l) out.push({ k: 'H', text: `Other hand: ${l}${first.M?.left ? '' : ' (held still as a base)'}` });
  }
  const start = label('L', first.L);
  const later = signForm.slice(1).map((s) => label('L', s.L)).filter(Boolean);
  if (start && later.length) out.push({ k: 'L', text: `Starts at: ${start} → moves to: ${later.join(' → ')}` });
  else if (start) out.push({ k: 'L', text: `Made at: ${start}` });
  const mv = label('M', first.M?.right || first.M?.left);
  if (mv) out.push({ k: 'M', text: `Movement: ${mv}${first.M?.right && first.M?.left ? ', both hands' : ''}` });
  const change = signForm.slice(1).map((s) => label('H', s.H?.right)).filter(Boolean);
  if (change.length) out.push({ k: 'H', text: `Hand changes to: ${change.join(' → ')}` });
  const face = label('E', first.E), head = label('HD', first.HD);
  if (face) out.push({ k: 'E', text: `Face: ${face}` });
  if (head) out.push({ k: 'HD', text: `Head: ${head}` });
  return out;
}
