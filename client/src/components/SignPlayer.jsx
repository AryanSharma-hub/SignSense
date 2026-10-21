import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Signer } from './Signer.jsx';
import { Icon } from './ui.jsx';
import { playSignForm } from '../lib/playSignForm.js';
import { createClock } from '../lib/clock.js';
import { mergeFull } from '../lib/steps.js';
import { fetchClip, canPlayClips } from '../lib/rig3d/clipData.js';

/**
 * A self-contained player for one sign: the avatar, play / replay, and slow motion.
 * Plays automatically when the sign changes (and loops, if asked). Used by lessons and tests.
 * Given the sign's `gloss`, it plays recorded signing (retargeted onto the 3D avatar) when
 * the server can provide it, and the rule-based steps otherwise.
 */
export function SignPlayer({ signForm, vocab, gloss = null, label = 'sign', autoPlay = true, loop = false, compact = false, framing = 'upper', className = '' }) {
  const finalPose = useMemo(() => mergeFull(signForm || []), [signForm]);
  const [pose, setPose] = useState(finalPose);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const clock = useRef(createClock());
  const ac = useRef(null);
  const [clip, setClip] = useState(undefined); // undefined: still asking; null: none
  const [span, setSpan] = useState(null);

  useEffect(() => {
    if (!gloss || !canPlayClips()) { setClip(null); return undefined; }
    const req = new AbortController();
    setClip(undefined);
    fetchClip([{ gloss }], { signal: req.signal }).then(setClip, () => { if (!req.signal.aborted) setClip(null); });
    return () => req.abort();
  }, [gloss]);

  const play = useCallback(async () => {
    ac.current?.abort();
    const c = new AbortController();
    ac.current = c;
    setPlaying(true);
    if (clip) {
      do {
        setSpan(null);
        await clock.current.wait(300, c.signal);
        setSpan([0, clip.duration]);
        await clock.current.wait(clip.duration * 1000 + (loop ? 700 : 0), c.signal);
      } while (loop && !c.signal.aborted);
      if (ac.current === c) { setPlaying(false); setSpan(null); }
      return;
    }
    do {
      setPose(mergeFull([]));
      await clock.current.wait(350, c.signal);
      const done = await playSignForm(signForm || [], { signal: c.signal, clock: clock.current, onFrame: (p) => setPose(p) });
      if (!done) return;
      await clock.current.wait(loop ? 900 : 0, c.signal);
    } while (loop && !c.signal.aborted);
    if (ac.current === c) setPlaying(false);
  }, [signForm, loop, clip]);

  useEffect(() => { clock.current.set({ speed: slow ? 0.5 : 1 }); }, [slow]);
  useEffect(() => {
    setPose(finalPose);
    if (autoPlay && clip !== undefined) play();
    return () => ac.current?.abort();
  }, [finalPose, autoPlay, play, clip]);

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="rounded-xl2 bg-[radial-gradient(ellipse_at_50%_35%,rgb(var(--surface2)),rgb(var(--surface))_75%)]">
        <Signer pose={pose} vocab={vocab} compact={compact} idle={!compact} speed={slow ? 0.5 : 1} framing={framing} clip={span ? clip : null} clipSpan={span} />
      </div>
      <div className={`mt-2 flex flex-wrap items-center justify-center gap-1.5 ${compact ? '' : 'gap-2'}`}>
        <button type="button" className={`btn ${compact ? '!min-h-[32px] !px-2 text-[12.5px]' : '!min-h-[38px] text-[14px]'}`} onClick={play} aria-label={`${playing ? 'Restart' : 'Play'} ${label}`}>
          <Icon name={playing ? 'replay' : 'play'} size={compact ? 12 : 15} /> {playing ? 'Replay' : 'Play'}
        </button>
        {!compact && (
          <button type="button" aria-pressed={slow} className={`btn !min-h-[38px] text-[14px] ${slow ? '!border-hand !bg-hand/15' : ''}`} onClick={() => setSlow(!slow)}>
            <Icon name="clock" size={15} /> Slow motion
          </button>
        )}
      </div>
    </div>
  );
}
