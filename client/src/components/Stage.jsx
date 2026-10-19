import { useState } from 'react';
import { SignerDummy, FRAMINGS } from './SignerDummy.jsx';
import { PartInspector, NowSigning } from './PartInspector.jsx';
import { PlaybackBar } from './PlaybackBar.jsx';
import { Icon } from './ui.jsx';
import { describePose } from '../lib/pose.js';
import { movementForDrag, headForDrag } from '../lib/direct.js';

const usePref = (key, initial) => {
  const [v, setV] = useState(() => { try { return localStorage.getItem(key) ?? initial; } catch { return initial; } });
  const set = (x) => { setV(x); try { localStorage.setItem(key, x); } catch { /* ignore */ } };
  return [v, set];
};

/**
 * The signer stage — the primary interactive surface for Direction A and the shared
 * performer for Direction B. Every body part is a target: tap it and its options open in
 * the inspector beside the figure (never over it); drag a hand for a movement or the face
 * for a head movement. Below sits the transport: act out, pause, step, scrub, speed.
 */
export function Stage({ composer, vocab, player }) {
  const { pose, activeHand, staged, arraySteps, dispatch } = composer;
  const [part, setPart] = useState(null); // { k, side? } | null
  const [framing, setFraming] = usePref('signsense:framing', 'upper');
  const [guides, setGuides] = usePref('signsense:guides', 'off');
  const shown = player.pose ?? pose;
  const performing = player.performing;

  const selectPart = (p) => {
    setPart(p);
    if (p?.side) dispatch({ type: 'setActiveHand', side: p.side });
  };
  const onDragPreview = (kind, side, rel) => {
    if (kind === 'hand') { const m = movementForDrag(vocab, rel, side); return m ? `${side === 'right' ? 'Right' : 'Left'} · ${m.label}` : null; }
    return headForDrag(vocab, rel)?.label ?? null;
  };
  const onDragCommit = (kind, side, rel) => {
    if (kind === 'hand') {
      dispatch({ type: 'setActiveHand', side });
      const m = movementForDrag(vocab, rel, side);
      if (m) { dispatch({ type: 'setM', id: m.id, side, set: true }); setPart({ k: 'M', side }); }
    } else {
      const h = headForDrag(vocab, rel);
      if (h) { dispatch({ type: 'setHD', id: h.id, set: true }); setPart({ k: 'HD' }); }
    }
  };

  const caption = performing
    ? `Signing ${player.label || '…'}${player.count > 1 ? ` (${player.word + 1} of ${player.count})` : ''}${player.paused ? ' — paused' : ''}`
    : describePose(pose, vocab);
  const canAct = arraySteps.length > 0 && !performing;
  const showGuides = guides === 'on';

  return (
    <section aria-label="Signer" className="panel stage-panel flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5">
        <h2 className="font-display text-[18px] font-semibold tracking-tight">Signer</h2>
        <p className="min-w-0 flex-1 truncate text-[13.5px] text-muted" aria-live="polite" title={caption}>
          {caption || 'Tap a body part to choose its options, or drag a hand to set its movement.'}
        </p>
        <div role="radiogroup" aria-label="Camera framing" className="inline-flex rounded-lg border border-line bg-surface2 p-0.5">
          {Object.entries(FRAMINGS).map(([k, fr]) => (
            <button
              key={k} type="button" role="radio" aria-checked={framing === k} onClick={() => setFraming(k)}
              className={`min-h-[30px] rounded-md px-2 text-[12.5px] font-semibold ${framing === k ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
            >{fr.label}</button>
          ))}
        </div>
        <button
          type="button" aria-pressed={showGuides} onClick={() => setGuides(showGuides ? 'off' : 'on')}
          title="Show the skeleton and movement paths"
          className={`btn !min-h-[34px] !px-2.5 text-[13px] ${showGuides ? '!border-movement !bg-movement/15 text-movement' : ''}`}
        ><Icon name="route" size={15} /> Paths</button>
      </header>

      <div className="stage-body min-h-0 flex-1">
        <div className="stage-avatar relative min-h-0">
          <div className="absolute inset-0 rounded-xl2 bg-[radial-gradient(ellipse_at_50%_35%,rgb(var(--surface2)),rgb(var(--surface))_70%)]" aria-hidden />
          <SignerDummy
            pose={shown} vocab={vocab} interactive={!performing} fit="contain" framing={framing}
            guides={showGuides} speed={player.speed} paused={performing && player.paused}
            selectedPart={performing ? null : part} editingHand={performing ? null : activeHand}
            onPartSelect={selectPart} onDragPreview={onDragPreview} onDragCommit={onDragCommit}
            locationTargets={part?.k === 'L' && !performing ? { selected: staged.L, onPick: (id) => dispatch({ type: 'setL', id }) } : null}
          />
        </div>
        <aside className="stage-inspector min-h-0" aria-label={performing ? 'Now signing' : 'Body part options'}>
          {performing
            ? <NowSigning player={player} vocab={vocab} />
            : <PartInspector composer={composer} vocab={vocab} part={part} onPart={selectPart} />}
        </aside>
      </div>

      <div className="shrink-0 border-t border-line px-3 py-2.5">
        <PlaybackBar
          player={player} canAct={canAct}
          onAct={() => player.perform([{ gloss: 'your sign', signForm: arraySteps }], { label: 'your sign', source: 'A' })}
        />
      </div>
    </section>
  );
}
