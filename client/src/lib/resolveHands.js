import { byId } from './vocabulary.js';

/**
 * Some handshapes are inherently two-palm shapes (open palms up, hands together) —
 * no single limb can perform them alone. Wherever one appears, on either side, both
 * hands are forced to it. This is enforced on EVERY hand-read path (dummy, array
 * badges, playback, search), so it can never be missed regardless of how a gesture's
 * data happens to store it.
 *
 * @returns {{right: string|null, left: string|null, joined: boolean}}
 */
export function resolveHands(H, vocab) {
  const hands = H || { right: null, left: null };
  let right = hands.right ?? null;
  let left = hands.left ?? null;
  const rBoth = !!byId(vocab, 'H', right)?.bothHanded;
  const lBoth = !!byId(vocab, 'H', left)?.bothHanded;
  let joined = false;
  if (rBoth) { left = right; joined = true; }
  else if (lBoth) { right = left; joined = true; }
  else if (right && left && right === left) { joined = true; }
  return { right, left, joined };
}
