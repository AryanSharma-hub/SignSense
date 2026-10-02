import { useCallback, useEffect, useRef, useState } from 'react';
import { playSequence, delay } from '../lib/playSignForm.js';

const IDLE = { pose: null, performing: false, source: null, marker: null, label: '', word: -1, count: 0, step: 0, steps: 0 };

/**
 * The single owner of the main signer stage's performance. Direction A (act out /
 * sentence), Direction B (hearing reply) and transcript replay all call perform().
 * While a performance is active, `pose` overrides whatever the signer is composing.
 */
export function useStagePlayer() {
  const [state, setState] = useState(IDLE);
  const ac = useRef(null);

  const cancel = useCallback(() => {
    ac.current?.abort();
    ac.current = null;
    setState(IDLE);
  }, []);

  const perform = useCallback(async (words, { marker = null, label = '', source = 'A' } = {}) => {
    ac.current?.abort();
    const controller = new AbortController();
    ac.current = controller;
    setState({ ...IDLE, performing: true, source, marker, label, count: words.length });
    const finished = await playSequence(words, {
      marker,
      signal: controller.signal,
      onWord: (i, w) => setState((s) => ({ ...s, word: i, label: w.gloss })),
      onFrame: (pose, info) => setState((s) => ({ ...s, pose, step: info.index, steps: info.count })),
    });
    if (finished) await delay(650, controller.signal); // let the last pose land before releasing the stage
    if (ac.current === controller) { ac.current = null; setState(IDLE); }
    return finished;
  }, []);

  useEffect(() => () => ac.current?.abort(), []);
  return { ...state, perform, cancel };
}
