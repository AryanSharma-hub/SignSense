import { applyMarker } from './nonManual.js';
import { blankStep, mergeFull } from './steps.js';

export const TIMING = { STEP_HOLD: 950, STEP_GAP: 120, WORD_GAP: 380 };

/** Abortable delay: resolves early (never rejects) when the signal aborts. */
export function delay(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(id); resolve(); }, { once: true });
  });
}

/**
 * THE gesture-playback sequencer. Every playback in the app goes through it:
 * live preview, "act out current array", Direction A sentences, Direction B replies,
 * transcript replay, and the suggestion mini-previews. Direction B does not get its own
 * rendering logic — it produces the same signForm objects and calls this.
 *
 * Respects index order, simultaneous groups (one step = one frame with all its
 * parameters at once) and per-hand independence. Each step is merged into a running
 * pose, so a parameter set in step 1 persists until a later step changes it.
 *
 * @param {Array} signForm  ordered steps
 * @param {{label?:string, marker?:object, signal?:AbortSignal, hold?:number, gap?:number,
 *          onFrame?:(pose:object, info:{index:number,count:number,step:object,label:string})=>void}} opts
 * @returns {Promise<boolean>} true if it ran to completion, false if aborted
 */
export async function playSignForm(signForm, opts = {}) {
  const { label = '', marker = null, signal, hold = TIMING.STEP_HOLD, gap = TIMING.STEP_GAP, onFrame, clock } = opts;
  const wait = clock ? clock.wait : delay;
  const steps = applyMarker(signForm, marker);
  let acc = blankStep();
  for (let i = 0; i < steps.length; i++) {
    if (signal?.aborted) return false;
    acc = mergeFull([acc, steps[i]]);
    onFrame?.(acc, { index: i, count: steps.length, step: steps[i], label });
    await wait(hold, signal);
    if (signal?.aborted) return false;
    await wait(gap, signal);
  }
  return true;
}

/** Play several words back-to-back with a pause between them. */
export async function playSequence(words, opts = {}) {
  const { marker = null, signal, onWord, onFrame, wordGap = TIMING.WORD_GAP, hold, gap } = opts;
  for (let w = 0; w < words.length; w++) {
    if (signal?.aborted) return false;
    onWord?.(w, words[w]);
    const finished = await playSignForm(words[w].signForm, { label: words[w].gloss, marker, signal, hold, gap, onFrame });
    if (!finished) return false;
    if (w < words.length - 1) await delay(wordGap, signal);
  }
  return true;
}

/**
 * The same accumulation as playSignForm, laid out up front as a flat list of frames —
 * one per step, across every word — so a player can step, scrub and jump to any word
 * instead of only running start to finish. Each frame carries its full merged pose.
 *
 * @returns {Array<{word:number, step:number, steps:number, gloss:string, pose:object, needsReview:boolean}>}
 */
export function buildTimeline(words, marker = null) {
  const frames = [];
  (words || []).forEach((w, wi) => {
    const steps = applyMarker(w.signForm || [], marker);
    let acc = blankStep();
    steps.forEach((st, si) => {
      acc = mergeFull([acc, st]);
      frames.push({ word: wi, step: si, steps: steps.length, gloss: w.gloss, pose: acc, needsReview: !!w.needsReview });
    });
  });
  return frames;
}
