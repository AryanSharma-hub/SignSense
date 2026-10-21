import { useCallback, useEffect, useRef, useState } from 'react';
import { buildTimeline, TIMING } from '../lib/playSignForm.js';
import { createClock } from '../lib/clock.js';
import { fetchClip, clipSpans, canPlayClips } from '../lib/rig3d/clipData.js';

const SPEED_KEY = 'signsense:speed';
export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25];
const readSpeed = () => { try { const v = Number(localStorage.getItem(SPEED_KEY)); return SPEEDS.includes(v) ? v : 1; } catch { return 1; } };

const IDLE = {
  pose: null, performing: false, paused: false, source: null, marker: null, label: '',
  word: -1, count: 0, step: 0, steps: 0, index: -1, frames: [], words: [],
  clip: null, loading: false,
};

/**
 * The single owner of the main signer stage's performance. Direction A (act out /
 * sentence), Direction B (hearing reply) and transcript replay all call perform().
 * While a performance is active, `pose` overrides whatever the signer is composing.
 *
 * A performance is a flat timeline of frames (lib/playSignForm.js buildTimeline), so it
 * can be paused, stepped frame by frame or word by word, scrubbed, slowed down and
 * replayed. Speed only changes how fast the timeline is walked — never its content.
 *
 * Library signs are performed from RECORDED signing when the 3D signer can play it: the
 * server returns a clip retargeted onto the avatar (POST /api/signing/animate) and the
 * timeline has one frame per word, each lasting that word's stretch of the clip. When the
 * clip can't be had (offline, turned off) the rule-based steps play instead, unchanged.
 */
export function useStagePlayer() {
  const [state, setState] = useState(() => ({ ...IDLE, speed: readSpeed(), last: null }));
  const R = useRef(null);
  if (!R.current) R.current = { frames: [], ac: null, clock: createClock({ speed: readSpeed() }), index: -1, stale: false };

  const show = useCallback((i) => {
    const r = R.current, f = r.frames[i];
    if (!f) return;
    r.index = i;
    setState((s) => ({ ...s, index: i, pose: f.pose, word: f.word, label: f.gloss, step: f.step, steps: f.steps }));
  }, []);

  /** Walk the timeline from frame `from`. Resolves true only if it reaches the end. */
  const run = useCallback(async (from) => {
    const r = R.current;
    r.ac?.abort();
    const ac = new AbortController();
    r.ac = ac; r.stale = false;
    const { clock } = r;
    for (let i = from; i < r.frames.length; i++) {
      show(i);
      const span = r.frames[i].span;
      if (span) { // a recorded word: as long as its stretch of the clip
        await clock.wait((span[1] - span[0]) * 1000, ac.signal);
        if (ac.signal.aborted) return false;
        continue;
      }
      await clock.wait(TIMING.STEP_HOLD, ac.signal);
      if (ac.signal.aborted) return false;
      const next = r.frames[i + 1];
      await clock.wait(next && next.word !== r.frames[i].word ? TIMING.WORD_GAP : TIMING.STEP_GAP, ac.signal);
      if (ac.signal.aborted) return false;
    }
    await clock.wait(r.frames[r.frames.length - 1]?.span ? 150 : 650, ac.signal); // let the last pose land before releasing the stage
    if (ac.signal.aborted) return false;
    if (r.ac === ac) {
      r.ac = null; r.index = -1;
      setState((s) => ({ ...IDLE, speed: s.speed, last: s.last }));
    }
    return true;
  }, [show]);

  const perform = useCallback(async (words, { marker = null, label = '', source = 'A', recorded = true } = {}) => {
    const r = R.current;
    r.ac?.abort(); r.req?.abort();
    const timeline = buildTimeline(words, marker);
    const base = { performing: true, source, marker, label, count: words.length, words, last: { words, opts: { marker, label, source, recorded } } };
    r.clock.set({ paused: false });

    let clip = null;
    if (recorded && !r.clipOff && words.length && canPlayClips()) {
      const req = new AbortController();
      r.req = req;
      setState((s) => ({ ...IDLE, speed: s.speed, ...base, loading: true }));
      try {
        clip = await fetchClip(words, { signal: req.signal });
      } catch (e) {
        if (req.signal.aborted) return false;
        if (e.status === 503) r.clipOff = true; // recorded signing is off on this server
      }
      if (r.req !== req) return false;
      r.req = null;
    }

    if (clip) {
      const spans = clipSpans(clip);
      // One frame per word; its pose is the word's full sign (for captions and the inspector).
      r.frames = words.map((w, i) => {
        const last = timeline.filter((f) => f.word === i).at(-1);
        return { word: i, step: 0, steps: 1, gloss: w.gloss, pose: last?.pose ?? null, needsReview: last?.needsReview, span: spans[i] };
      });
    } else r.frames = timeline;
    setState((s) => ({ ...IDLE, speed: s.speed, ...base, frames: r.frames, clip }));
    return run(0);
  }, [run]);

  const cancel = useCallback(() => {
    const r = R.current;
    r.ac?.abort(); r.ac = null; r.index = -1;
    r.req?.abort(); r.req = null;
    r.clock.set({ paused: false });
    setState((s) => ({ ...IDLE, speed: s.speed, last: s.last }));
  }, []);

  const pause = useCallback(() => { R.current.clock.set({ paused: true }); setState((s) => ({ ...s, paused: true })); }, []);
  const resume = useCallback(() => {
    const r = R.current;
    r.clock.set({ paused: false });
    setState((s) => ({ ...s, paused: false }));
    if (r.stale) run(Math.max(0, r.index));
  }, [run]);

  /** Jump to any frame. While paused it only shows that frame; playing continues from it. */
  const seek = useCallback((i) => {
    const r = R.current;
    if (!r.frames.length) return;
    const to = Math.max(0, Math.min(r.frames.length - 1, i));
    if (r.clock.paused) { r.ac?.abort(); r.stale = true; show(to); }
    else run(to);
  }, [run, show]);

  const firstFrameOfWord = (w) => R.current.frames.findIndex((f) => f.word === w);
  const next = useCallback(() => seek(R.current.index + 1), [seek]);
  const prev = useCallback(() => seek(R.current.index - 1), [seek]);
  const jumpToWord = useCallback((w) => { const i = firstFrameOfWord(w); if (i >= 0) seek(i); }, [seek]);
  const restart = useCallback(() => { const r = R.current; r.clock.set({ paused: false }); setState((s) => ({ ...s, paused: false })); run(0); }, [run]);

  const replay = useCallback(() => {
    const last = state.last;
    if (last) perform(last.words, last.opts);
  }, [state.last, perform]);

  const setSpeed = useCallback((v) => {
    R.current.clock.set({ speed: v });
    try { localStorage.setItem(SPEED_KEY, String(v)); } catch { /* ignore */ }
    setState((s) => ({ ...s, speed: v }));
  }, []);

  useEffect(() => () => { R.current.ac?.abort(); R.current.req?.abort(); }, []);
  return { ...state, perform, cancel, pause, resume, seek, next, prev, jumpToWord, restart, replay, setSpeed };
}
