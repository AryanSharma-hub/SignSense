import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { SignerDummy } from './SignerDummy.jsx';
import { Icon, ParamChip } from './ui.jsx';
import { searchGestures } from '../lib/search.js';
import { flattenStepsFlat, mergeFull } from '../lib/steps.js';
import { playSignForm } from '../lib/playSignForm.js';
import { byId } from '../lib/vocabulary.js';

/** Thumbnail of a gesture's final pose; animates through its steps on hover, focus or autoplay. */
function MiniPreview({ gesture, vocab, autoplay }) {
  const finalPose = useMemo(() => mergeFull(gesture.signForm), [gesture]);
  const [pose, setPose] = useState(finalPose);
  const ac = useRef(null);

  const play = useCallback(async () => {
    ac.current?.abort();
    const c = new AbortController();
    ac.current = c;
    const done = await playSignForm(gesture.signForm, { signal: c.signal, hold: 700, gap: 60, onFrame: (p) => setPose(p) });
    if (done) setPose(finalPose);
  }, [gesture, finalPose]);

  useEffect(() => { setPose(finalPose); }, [finalPose]);
  useEffect(() => { if (autoplay) play(); }, [autoplay, play]);
  useEffect(() => () => ac.current?.abort(), []);

  return (
    <div className="w-[76px] shrink-0 rounded-lg bg-surface2" onMouseEnter={play} onFocus={play} tabIndex={-1} aria-hidden="true">
      <SignerDummy pose={pose} vocab={vocab} compact />
    </div>
  );
}

/** Live weighted search over all five parameters as the array is built. */
export function Suggestions({ composer, vocab, gestures, player, onAddWord }) {
  const query = useMemo(() => flattenStepsFlat(composer.arraySteps), [composer.arraySteps]);
  const deferred = useDeferredValue(query);
  const filled = Object.values(deferred).some(Boolean);
  const results = useMemo(
    () => (filled ? searchGestures(deferred, gestures, vocab).filter((r) => r.score >= 0.3).slice(0, 6) : []),
    [deferred, filled, gestures, vocab]);

  return (
    <section className="panel p-4" aria-label="Suggested signs">
      <h2 className="font-display text-[18px] font-semibold tracking-tight">Suggestions</h2>
      <p className="mb-3 text-[13.5px] text-muted">Signs that match what you have built so far. They update as you go.</p>

      {!filled && <p className="rounded-xl bg-surface2 px-3 py-4 text-[14.5px] text-muted">Start with any part of a sign — a hand, a place on the body, a movement — and matching signs appear here.</p>}
      {filled && results.length === 0 && <p className="rounded-xl bg-surface2 px-3 py-4 text-[14.5px] text-muted">No close matches yet. Try changing or removing one part.</p>}

      <ul className="space-y-2" aria-live="polite">
        {results.map((g, i) => (
          <li key={g.id} className="flex items-center gap-3 rounded-xl border border-line p-2">
            <MiniPreview gesture={g} vocab={vocab} autoplay={i === 0} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="gloss text-[17px]">{g.gloss}</span>
                {g.exact
                  ? <span className="rounded-md bg-ok/15 px-1.5 py-0.5 text-[12.5px] font-bold text-ok">Exact match</span>
                  : <span className="text-[13px] font-semibold text-muted">{Math.round(g.score * 100)}% close</span>}
                {g.needsReview && <span title="Sign data not yet reviewed by an ASL-fluent reviewer" className="rounded-md border border-line px-1.5 py-0.5 text-[12px] font-semibold text-muted">Draft</span>}
              </div>
              <p className="truncate text-[13.5px] text-muted">{g.meaning}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {g.flat.L && <ParamChip k="L">{byId(vocab, 'L', g.flat.L)?.label}</ParamChip>}
                {g.flat.H && <ParamChip k="H">{byId(vocab, 'H', g.flat.H)?.label}</ParamChip>}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
              <button type="button" className="btn !min-h-[40px] !px-2.5" aria-label={`Play ${g.gloss} on the signer`} disabled={player.performing} onClick={() => player.perform([g], { label: g.gloss, source: 'A' })}><Icon name="play" size={14} /></button>
              <button type="button" className="btn btn-primary !min-h-[40px] !px-3 text-[14px]" onClick={() => onAddWord(g)}>Add</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
