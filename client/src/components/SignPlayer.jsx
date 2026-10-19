import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SignerDummy } from './SignerDummy.jsx';
import { Icon } from './ui.jsx';
import { playSignForm } from '../lib/playSignForm.js';
import { createClock } from '../lib/clock.js';
import { mergeFull } from '../lib/steps.js';

/**
 * A self-contained player for one sign: the avatar, play / replay, and slow motion.
 * Plays automatically when the sign changes (and loops, if asked). Used by lessons and tests.
 */
export function SignPlayer({ signForm, vocab, label = 'sign', autoPlay = true, loop = false, compact = false, framing = 'upper', className = '' }) {
  const finalPose = useMemo(() => mergeFull(signForm || []), [signForm]);
  const [pose, setPose] = useState(finalPose);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const clock = useRef(createClock());
  const ac = useRef(null);

  const play = useCallback(async () => {
    ac.current?.abort();
    const c = new AbortController();
    ac.current = c;
    setPlaying(true);
    do {
      setPose(mergeFull([]));
      await clock.current.wait(350, c.signal);
      const done = await playSignForm(signForm || [], { signal: c.signal, clock: clock.current, onFrame: (p) => setPose(p) });
      if (!done) return;
      await clock.current.wait(loop ? 900 : 0, c.signal);
    } while (loop && !c.signal.aborted);
    if (ac.current === c) setPlaying(false);
  }, [signForm, loop]);

  useEffect(() => { clock.current.set({ speed: slow ? 0.5 : 1 }); }, [slow]);
  useEffect(() => { setPose(finalPose); if (autoPlay) play(); return () => ac.current?.abort(); }, [finalPose, autoPlay, play]);

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="rounded-xl2 bg-[radial-gradient(ellipse_at_50%_35%,rgb(var(--surface2)),rgb(var(--surface))_75%)]">
        <SignerDummy pose={pose} vocab={vocab} compact={compact} idle={!compact} speed={slow ? 0.5 : 1} framing={framing} />
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
