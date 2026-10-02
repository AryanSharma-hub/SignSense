import { useState } from 'react';
import { SignerDummy } from './SignerDummy.jsx';
import { OptionGrid, Icon, Segmented } from './ui.jsx';
import { describePose } from '../lib/pose.js';
import { describeMarker } from '../lib/nonManual.js';
import { movementForDrag, headForDrag } from '../lib/direct.js';

/**
 * The signer stage — the primary interactive surface for Direction A and the shared
 * performer for Direction B. Direct manipulation: drag a hand to snap a movement, drag the
 * head for head movement, tap a hand for handshapes, tap the face for expressions.
 */
export function Stage({ composer, vocab, player }) {
  const { pose, activeHand, staged, arraySteps, dispatch } = composer;
  const [picker, setPicker] = useState(null); // 'E' | 'H' | 'L' | null
  const shown = player.pose ?? pose;
  const performing = player.performing;

  const onHandTap = (side) => { dispatch({ type: 'setActiveHand', side }); setPicker('H'); };
  const onHeadTap = () => setPicker('E');
  const onDragPreview = (kind, side, rel) => {
    if (kind === 'hand') { const m = movementForDrag(vocab, rel, side); return m ? `${side === 'right' ? 'Right' : 'Left'} · ${m.label}` : null; }
    return headForDrag(vocab, rel)?.label ?? null;
  };
  const onDragCommit = (kind, side, rel) => {
    if (kind === 'hand') {
      dispatch({ type: 'setActiveHand', side });
      const m = movementForDrag(vocab, rel, side);
      if (m) dispatch({ type: 'setM', id: m.id, side, set: true });
    } else {
      const h = headForDrag(vocab, rel);
      if (h) dispatch({ type: 'setHD', id: h.id, set: true });
    }
  };

  const caption = performing
    ? `Signing ${player.label || '…'}${player.count > 1 ? ` (${player.word + 1} of ${player.count})` : ''}`
    : describePose(pose, vocab);
  const canAct = arraySteps.length > 0 && !performing;

  return (
    <section aria-label="Signer" className="panel relative overflow-hidden p-3 sm:p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="font-display text-[18px] font-semibold tracking-tight">Signer</h2>
        {performing
          ? <button type="button" className="btn btn-quiet !min-h-[36px] !px-2.5 text-[14px]" onClick={player.cancel}><Icon name="stop" size={14} /> Stop</button>
          : <button type="button" className="btn btn-quiet !min-h-[36px] !px-2.5 text-[14px]" disabled={!canAct} onClick={() => player.perform([{ gloss: 'your sign', signForm: arraySteps }], { label: 'your sign', source: 'A' })}><Icon name="play" size={14} /> Act out</button>}
      </div>

      <div className="mx-auto max-w-[340px] rounded-xl2 bg-gradient-to-b from-surface2 to-surface">
        <SignerDummy
          pose={shown} vocab={vocab} interactive={!performing}
          onHandTap={onHandTap} onHeadTap={onHeadTap} onDragPreview={onDragPreview} onDragCommit={onDragCommit}
          locationTargets={picker === 'L' && !performing ? { selected: staged.L, onPick: (id) => dispatch({ type: 'setL', id }) } : null}
        />
      </div>

      <p className="mt-1 min-h-[2.75rem] text-center text-[14px] leading-snug text-muted" aria-live="polite">
        {caption || 'Drag a hand to set its movement. Tap a hand or the face to choose a shape or expression.'}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Segmented
          label="Which hand to edit" value={activeHand} onChange={(side) => dispatch({ type: 'setActiveHand', side })}
          options={[{ value: 'left', label: 'Left hand' }, { value: 'right', label: 'Right hand' }]}
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {[['E', 'Face'], ['H', 'Handshape'], ['L', 'Location']].map(([k, label]) => (
          <button
            key={k} type="button" aria-pressed={picker === k} onClick={() => setPicker(picker === k ? null : k)}
            className={`btn !min-h-[40px] !px-3 text-[14px] ${picker === k ? 'border-ink' : ''}`}
          >{label}</button>
        ))}
      </div>

      {picker && !performing && (
        <div className="absolute inset-x-2 bottom-2 z-20 max-h-[68%] overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-lift scroll-thin" role="dialog" aria-label={picker === 'E' ? 'Choose an expression' : picker === 'H' ? 'Choose a handshape' : 'Choose a location'}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold">
              {picker === 'E' && 'Facial expression'}
              {picker === 'H' && `Handshape — ${activeHand === 'right' ? 'right' : 'left'} hand`}
              {picker === 'L' && 'Where on the body'}
            </h3>
            <button type="button" className="btn btn-quiet !min-h-[36px] !px-2" onClick={() => setPicker(null)} aria-label="Close"><Icon name="x" /></button>
          </div>
          {picker === 'E' && (
            <OptionGrid k="E" items={vocab.expressions} selected={[staged.E]} onPick={(id) => { dispatch({ type: 'setE', id }); setPicker(null); }} />
          )}
          {picker === 'H' && (
            <OptionGrid k="H" hands items={vocab.hands} selected={[staged.H[activeHand]]} onPick={(id) => { dispatch({ type: 'setH', id, side: activeHand }); setPicker(null); }} />
          )}
          {picker === 'L' && (
            <>
              <p className="mb-2 text-[13.5px] text-muted">Tap a dot on the signer, or choose here. Leave empty for the neutral chest position.</p>
              <OptionGrid k="L" items={vocab.locations} selected={[staged.L]} onPick={(id) => dispatch({ type: 'setL', id })} />
            </>
          )}
        </div>
      )}

      {performing && describeMarker(player.marker, vocab) && (
        <p className="text-center text-[13px] font-semibold text-muted">Face and head: {describeMarker(player.marker, vocab)}</p>
      )}
    </section>
  );
}
