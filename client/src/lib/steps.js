/**
 * The step object shape (v1, extended by one nullable field):
 *   { E, HD, L, H:{right,left}, M:{right,left} }
 * E/HD/L are not hand-specific. H and M are {right,left}: the SAME id on both sides is
 * a joined two-hand sign; DIFFERENT ids are independent hands (e.g. HELP: fist on palm).
 * L (location) is nullable — null means the neutral/chest default, so data written
 * before the location parameter existed keeps working unchanged.
 */
export const blankStep = () => ({ E: null, HD: null, L: null, H: { right: null, left: null }, M: { right: null, left: null }, together: [] });

export const cloneStep = (s) => ({
  E: s?.E ?? null, HD: s?.HD ?? null, L: s?.L ?? null,
  H: { right: s?.H?.right ?? null, left: s?.H?.left ?? null },
  M: { right: s?.M?.right ?? null, left: s?.M?.left ?? null },
  together: (s?.together ?? []).map((p) => [...p]),
});

/**
 * "Together": an explicit, author/query-time annotation that two parameters in the SAME
 * step are a deliberately linked pair (distinct from `joined`, which the hand parameter
 * alone derives for two-palm handshapes). A step is already one simultaneous frame, so
 * this never changes playback — it's a storage/display annotation only.
 */
const TOGETHER_FILLED = {
  E: (s) => !!s.E, HD: (s) => !!s.HD, L: (s) => !!s.L,
  H: (s) => !!(s.H?.right || s.H?.left), M: (s) => !!(s.M?.right || s.M?.left),
};
const pairKey = (a, b) => [a, b].sort().join('+');

/** Does `together` already contain the pair {a,b} (order-independent)? */
export function hasPair(together, a, b) {
  return (together || []).some((p) => pairKey(p[0], p[1]) === pairKey(a, b));
}

/** Toggle the pair {a,b} in/out of a `together` list. */
export function togglePair(together, a, b) {
  if (!a || !b || a === b) return together || [];
  if (hasPair(together, a, b)) return together.filter((p) => pairKey(p[0], p[1]) !== pairKey(a, b));
  return [...(together || []), [a, b].sort()];
}

/** Drop any pair that references a parameter key whose slot is no longer filled on this step. */
export function prunedTogether(step) {
  return (step.together || []).filter(([a, b]) => TOGETHER_FILLED[a]?.(step) && TOGETHER_FILLED[b]?.(step));
}

export function stepHasAny(step) {
  return !!(step && (step.E || step.HD || step.L || step.H?.right || step.H?.left || step.M?.right || step.M?.left));
}

/** Hand-aware merge of an ordered list of steps into one full pose (later steps win). */
export function mergeFull(steps) {
  const out = blankStep();
  for (const step of steps) {
    if (!step) continue;
    if (step.E) out.E = step.E;
    if (step.HD) out.HD = step.HD;
    if (step.L) out.L = step.L;
    if (step.H?.right != null) out.H.right = step.H.right;
    if (step.H?.left != null) out.H.left = step.H.left;
    if (step.M?.right != null) out.M.right = step.M.right;
    if (step.M?.left != null) out.M.left = step.M.left;
  }
  return out;
}

/** Flattened {E,H,M,HD,L} used only for parallel-search scoring (right hand wins, else left). */
export function flattenStepsFlat(steps) {
  const out = { E: null, H: null, M: null, HD: null, L: null };
  for (const step of steps) {
    if (!step) continue;
    if (step.E) out.E = step.E;
    if (step.HD) out.HD = step.HD;
    if (step.L) out.L = step.L;
    const h = step.H?.right || step.H?.left; if (h) out.H = h;
    const m = step.M?.right || step.M?.left; if (m) out.M = m;
  }
  return out;
}
