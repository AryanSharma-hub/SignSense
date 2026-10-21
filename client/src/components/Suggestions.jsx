import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Signer } from './Signer.jsx';
import { Icon, ParamChip, TONE, SourceBadge } from './ui.jsx';
import { searchGestures, explainMatch, searchText } from '../lib/search.js';
import { flattenStepsFlat, mergeFull } from '../lib/steps.js';
import { playSignForm } from '../lib/playSignForm.js';

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
    <div className="w-[64px] shrink-0 overflow-hidden rounded-lg bg-surface2" onMouseEnter={play} onFocus={play} tabIndex={-1} aria-hidden="true">
      <Signer pose={pose} vocab={vocab} compact framing="upper" />
    </div>
  );
}

const WHY_MARK = { same: '✓', similar: '≈', different: '✗' };
const WHY_TEXT = { same: 'matches', similar: 'similar', different: 'differs' };

/** One sign result: preview, name, why it matched, data-quality flag, play and add. */
function SignRow({ g, vocab, player, onAdd, onPlay, autoplay, badge, why }) {
  return (
    <li className="flex items-start gap-2.5 rounded-xl border border-line bg-surface p-2 transition-colors hover:border-hand/40">
      <MiniPreview gesture={g} vocab={vocab} autoplay={autoplay} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="gloss text-[16px]">{g.gloss}</span>
          {badge}
          <SourceBadge sign={g} />
        </div>
        {g.meaning && <p className="truncate text-[13px] text-muted" title={g.meaning}>{g.meaning}</p>}
        {why && <div className="mt-1 flex flex-wrap gap-1">{why}</div>}
        <div className="mt-1.5 flex gap-1.5">
          <button type="button" className="btn !min-h-[32px] !px-2 text-[13px]" aria-label={`Play ${g.gloss} on the signer`} disabled={player.performing} onClick={() => onPlay(g)}><Icon name="play" size={12} /> Play</button>
          <button type="button" className="btn btn-primary !min-h-[32px] !px-2.5 text-[13px]" onClick={() => onAdd(g)}>Add</button>
        </div>
      </div>
    </li>
  );
}

/**
 * Suggestions: signs that match what is being built (parameter search over all five
 * parameters, with the reason each one matched), a word search over the whole library,
 * and the signs viewed recently. Exact and approximate matches are labelled differently.
 */
export function Suggestions({ composer, vocab, gestures, player, onAddWord }) {
  const query = useMemo(() => flattenStepsFlat(composer.arraySteps), [composer.arraySteps]);
  const deferred = useDeferredValue(query);
  const filled = Object.values(deferred).some(Boolean);
  const results = useMemo(
    () => (filled ? searchGestures(deferred, gestures, vocab).filter((r) => r.score >= 0.3).slice(0, 6) : []),
    [deferred, filled, gestures, vocab]);

  const [text, setText] = useState('');
  const deferredText = useDeferredValue(text);
  const found = useMemo(() => searchText(deferredText, gestures, 12), [deferredText, gestures]);

  const [recent, setRecent] = useState([]);
  const remember = (g) => setRecent((r) => [g, ...r.filter((x) => x.id !== g.id)].slice(0, 8));
  const play = (g) => { remember(g); player.perform([g], { label: g.gloss, source: 'A' }); };
  const add = (g) => { remember(g); onAddWord(g); };

  const why = (g) => explainMatch(deferred, g.flat || flattenStepsFlat(g.signForm), vocab).map(({ k, kind }) => (
    <span
      key={k} title={`${TONE[k].name} ${WHY_TEXT[kind]}`}
      className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[11.5px] font-semibold leading-tight
        ${kind === 'same' ? TONE[k].soft : kind === 'similar' ? 'border-line bg-surface2 text-ink' : 'border-line text-muted line-through decoration-1'}`}
    ><span aria-hidden>{WHY_MARK[kind]}</span> {TONE[k].name}</span>
  ));

  return (
    <section className="panel flex min-h-full flex-col p-3.5" aria-label="Suggested signs">
      <h2 className="font-display text-[18px] font-semibold tracking-tight">Suggestions</h2>
      <p className="mb-2.5 text-[13px] text-muted">Signs matching what you build, or search the library by word.</p>

      <label className="relative mb-3 block">
        <span className="sr-only">Search signs by word</span>
        <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Search ${gestures.length.toLocaleString()} signs…`}
          className="min-h-[40px] w-full rounded-xl border border-line bg-surface2 pl-9 pr-3 text-[15px] placeholder:text-muted/70"
        />
      </label>

      {deferredText.trim() && (
        <div className="mb-4">
          <p className="field-label mb-1.5">Search results{found.length ? ` · ${found.length}` : ''}</p>
          {found.length === 0
            ? <p className="rounded-xl bg-surface2 px-3 py-3 text-[14px] text-muted">No sign for “{deferredText.trim()}” in the library. In a conversation it would be fingerspelled.</p>
            : (
              <ul className="space-y-2">
                {found.map(({ gesture: g, reason, exact }) => (
                  <SignRow
                    key={`t-${g.id}`} g={g} vocab={vocab} player={player} onAdd={add} onPlay={play}
                    badge={exact
                      ? <span className="rounded-md bg-ok/15 px-1.5 py-0.5 text-[11.5px] font-bold text-ok">{reason}</span>
                      : <span className="text-[12px] font-semibold text-muted">{reason}</span>}
                  />
                ))}
              </ul>
            )}
        </div>
      )}

      <p className="field-label mb-1.5">Matches for your sign</p>
      {!filled && (
        <div className="rounded-xl bg-surface2 px-3 py-3 text-[14px] leading-relaxed text-muted">
          <p>Start with any part of a sign: tap a hand, the face, an arm or the body on the signer. Matching signs appear here as you go.</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {['H', 'L', 'M', 'E', 'HD'].map((k) => <ParamChip key={k} k={k}>{TONE[k].name}</ParamChip>)}
          </div>
        </div>
      )}
      {filled && results.length === 0 && <p className="rounded-xl bg-surface2 px-3 py-3 text-[14px] text-muted">No close matches yet. Try changing or removing one part.</p>}

      <ul className="space-y-2" aria-live="polite">
        {results.map((g, i) => (
          <SignRow
            key={g.id} g={g} vocab={vocab} player={player} onAdd={add} onPlay={play} autoplay={i === 0}
            badge={g.exact
              ? <span className="rounded-md bg-ok/15 px-1.5 py-0.5 text-[11.5px] font-bold text-ok">Exact match</span>
              : <span className="text-[12px] font-semibold text-muted">{Math.round(g.score * 100)}% close</span>}
            why={why(g)}
          />
        ))}
      </ul>

      {recent.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="field-label mb-1.5">Recently viewed</p>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((g) => (
              <button key={`r-${g.id}`} type="button" disabled={player.performing} onClick={() => play(g)}
                className="chip border-line bg-surface !py-0.5 text-[13px] hover:bg-surface2" aria-label={`Play ${g.gloss} again`}>
                <Icon name="play" size={10} /> <span className="font-semibold tracking-wide">{g.gloss}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
