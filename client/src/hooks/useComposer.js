import { useCallback, useMemo, useReducer, useRef } from 'react';
import { blankStep, cloneStep, mergeFull, stepHasAny, prunedTogether, togglePair } from '../lib/steps.js';
import { resolveHands } from '../lib/resolveHands.js';
import { markerFor } from '../lib/nonManual.js';
import { byId } from '../lib/vocabulary.js';

let uid = 0;
const nextKey = () => `w${++uid}`;

const init = () => ({
  steps: [], staged: blankStep(), editingIndex: null, activeHand: 'right',
  words: [], markerMode: 'auto',
});

const toggle = (cur, id) => (cur === id ? null : id);

function commitStaged(s) {
  if (!stepHasAny(s.staged)) return s;
  const steps = s.steps.slice();
  if (s.editingIndex != null) steps[s.editingIndex] = cloneStep(s.staged);
  else steps.push(cloneStep(s.staged));
  return { ...s, steps, staged: blankStep(), editingIndex: null };
}

function reduce(s, a, vocab) {
  switch (a.type) {
    case 'setActiveHand': return { ...s, activeHand: a.side };
    case 'setE': {
      const staged = { ...s.staged, E: toggle(s.staged.E, a.id) };
      return { ...s, staged: { ...staged, together: prunedTogether(staged) } };
    }
    case 'setHD': {
      const staged = { ...s.staged, HD: a.set ? a.id : toggle(s.staged.HD, a.id) };
      return { ...s, staged: { ...staged, together: prunedTogether(staged) } };
    }
    case 'setL': {
      const staged = { ...s.staged, L: toggle(s.staged.L, a.id) };
      return { ...s, staged: { ...staged, together: prunedTogether(staged) } };
    }
    case 'setH': {
      const both = !!byId(vocab, 'H', a.id)?.bothHanded;
      const H = { ...s.staged.H };
      if (both) {
        const on = H.right === a.id || H.left === a.id;
        H.right = on ? null : a.id; H.left = on ? null : a.id;
      } else {
        H[a.side] = toggle(H[a.side], a.id);
        // Leaving a two-palm shape on the other side would re-force this hand; drop it.
        const other = a.side === 'right' ? 'left' : 'right';
        if (byId(vocab, 'H', H[other])?.bothHanded) H[other] = null;
      }
      const staged = { ...s.staged, H };
      return { ...s, staged: { ...staged, together: prunedTogether(staged) } };
    }
    case 'setM': {
      const M = { ...s.staged.M };
      const joined = resolveHands(s.staged.H, vocab).joined;
      const sides = joined ? ['right', 'left'] : [a.side];
      const on = !a.set && sides.every((x) => M[x] === a.id);
      sides.forEach((x) => { M[x] = on ? null : a.id; });
      const staged = { ...s.staged, M };
      return { ...s, staged: { ...staged, together: prunedTogether(staged) } };
    }
    case 'togglePairTogether': return { ...s, staged: { ...s.staged, together: togglePair(s.staged.together, a.a, a.b) } };
    // Manual fingerspelling: each letter/digit is its own step, added directly (not staged),
    // so spelling a word doesn't disturb whatever is currently being composed.
    case 'addLetterStep': return { ...s, steps: [...s.steps, { ...blankStep(), H: { right: a.id, left: null } }] };
    case 'clearStaged': return { ...s, staged: blankStep(), editingIndex: null };
    case 'commit': return commitStaged(s);
    case 'loadStep': {
      const c = commitStaged(s);
      return { ...c, staged: cloneStep(c.steps[a.index]), editingIndex: a.index };
    }
    case 'removeStep': {
      const steps = s.steps.filter((_, i) => i !== a.index);
      let editingIndex = s.editingIndex;
      if (editingIndex === a.index) return { ...s, steps, staged: blankStep(), editingIndex: null };
      if (editingIndex != null && a.index < editingIndex) editingIndex -= 1;
      return { ...s, steps, editingIndex };
    }
    case 'moveStep': {
      const steps = s.steps.slice();
      const [m] = steps.splice(a.from, 1);
      steps.splice(a.to, 0, m);
      return { ...s, steps, editingIndex: s.editingIndex === a.from ? a.to : s.editingIndex };
    }
    case 'clearAll': return { ...s, steps: [], staged: blankStep(), editingIndex: null };

    case 'addWord': return { ...s, words: [...s.words, { key: nextKey(), ...a.word }] };
    case 'removeWord': return { ...s, words: s.words.filter((w) => w.key !== a.key) };
    case 'moveWord': {
      const words = s.words.slice();
      const [m] = words.splice(a.from, 1);
      words.splice(a.to, 0, m);
      return { ...s, words };
    }
    case 'clearWords': return { ...s, words: [] };
    case 'setMarkerMode': return { ...s, markerMode: a.mode };
    default: return s;
  }
}

/**
 * Direction A state: the array/timeline of committed steps, the staged step being
 * edited, and the sentence being built. Hand-aware rules (resolveHands) are applied here
 * at write time so every consumer sees consistent data.
 */
export function useComposer(vocab) {
  const vocabRef = useRef(vocab);
  vocabRef.current = vocab;
  const [state, dispatch] = useReducer((s, a) => reduce(s, a, vocabRef.current), undefined, init);

  // Pose on the stage while composing: committed steps + the staged step merged.
  const pose = useMemo(() => {
    const list = state.editingIndex == null
      ? [...state.steps, state.staged]
      : state.steps.map((st, i) => (i === state.editingIndex ? state.staged : st));
    return mergeFull(list);
  }, [state.steps, state.staged, state.editingIndex]);

  /** The array as it would be performed (staged step included). */
  const arraySteps = useMemo(() => {
    if (state.editingIndex != null) return state.steps.map((st, i) => (i === state.editingIndex ? state.staged : st));
    return stepHasAny(state.staged) ? [...state.steps, state.staged] : state.steps;
  }, [state.steps, state.staged, state.editingIndex]);

  /** Grammar the signer expressed: explicit choice, else read from the faces/heads they signed. */
  const marker = useMemo(() => {
    if (state.markerMode !== 'auto') return markerFor({ type: state.markerMode }, vocab);
    const question = state.words.some((w) => w.nonManual?.E && byId(vocab, 'E', w.nonManual.E)?.family === 'questioning');
    const negated = state.words.some((w) => w.nonManual?.HD && byId(vocab, 'HD', w.nonManual.HD)?.family === 'negative');
    return markerFor({ type: question ? 'question' : negated ? 'negation' : 'statement', negated }, vocab);
  }, [state.words, state.markerMode, vocab]);

  /** Non-manual signals currently on the array, to carry onto a sentence word. */
  const currentNonManual = useCallback(() => {
    const full = mergeFull(arraySteps);
    const nm = {};
    if (full.E && byId(vocab, 'E', full.E)?.family === 'questioning') nm.E = full.E;
    if (full.HD && byId(vocab, 'HD', full.HD)?.family === 'negative') nm.HD = full.HD;
    return Object.keys(nm).length ? nm : null;
  }, [arraySteps, vocab]);

  return { ...state, pose, arraySteps, marker, currentNonManual, dispatch };
}
