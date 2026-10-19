import { useState } from 'react';
import { ParamChip, Icon } from './ui.jsx';
import { resolveHands } from '../lib/resolveHands.js';
import { stepHasAny } from '../lib/steps.js';
import { byId } from '../lib/vocabulary.js';

const linkSuffix = (step, k) => ((step.together || []).some((p) => p.includes(k)) ? <span key={`${k}-link`} aria-hidden className="ml-0.5">🔗</span> : null);

/** Chips for one step. Hands are read through resolveHands, like every other hand-read path.
 * A 🔗 marks a parameter explicitly tagged as "together" with another part of this step
 * (see lib/steps.js togglePair/prunedTogether) — informational, every chip here already
 * plays simultaneously since a step is one frame. */
export function StepBadges({ step, vocab }) {
  const HR = resolveHands(step.H, vocab);
  const label = (k, id) => byId(vocab, k, id)?.label ?? id;
  const out = [];
  const linked = (k) => (step.together || []).some((p) => p.includes(k));
  if (step.E) out.push(<ParamChip key="e" k="E" title={linked('E') ? 'Linked: happens together with another part' : undefined}>{label('E', step.E)}{linkSuffix(step, 'E')}</ParamChip>);
  if (HR.joined) out.push(<ParamChip key="h" k="H">Both · {label('H', HR.right)}{linkSuffix(step, 'H')}</ParamChip>);
  else {
    if (HR.right) out.push(<ParamChip key="hr" k="H">R · {label('H', HR.right)}{linkSuffix(step, 'H')}</ParamChip>);
    if (HR.left) out.push(<ParamChip key="hl" k="H">L · {label('H', HR.left)}{linkSuffix(step, 'H')}</ParamChip>);
  }
  const { right: mr, left: ml } = step.M || {};
  if (mr && ml && mr === ml) out.push(<ParamChip key="m" k="M">{label('M', mr)}{linkSuffix(step, 'M')}</ParamChip>);
  else {
    if (mr) out.push(<ParamChip key="mr" k="M">R · {label('M', mr)}{linkSuffix(step, 'M')}</ParamChip>);
    if (ml) out.push(<ParamChip key="ml" k="M">L · {label('M', ml)}{linkSuffix(step, 'M')}</ParamChip>);
  }
  if (step.L) out.push(<ParamChip key="l" k="L">{label('L', step.L)}{linkSuffix(step, 'L')}</ParamChip>);
  if (step.HD) out.push(<ParamChip key="hd" k="HD">{label('HD', step.HD)}{linkSuffix(step, 'HD')}</ParamChip>);
  return <div className="flex flex-wrap gap-1">{out.length ? out : <span className="text-[13px] text-muted">Empty</span>}</div>;
}

/**
 * The array / timeline: an abstracted, ordered list of steps. Tap a step to reload it
 * for correction; drag to reorder (or use the arrow buttons — touch and keyboard friendly).
 */
export function StepsBar({ composer, vocab }) {
  const { steps, staged, editingIndex, dispatch } = composer;
  const [dragFrom, setDragFrom] = useState(null);
  const hasStaged = stepHasAny(staged);
  const editing = editingIndex != null;

  return (
    <section className="panel p-3.5" aria-label="Sign steps">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-tight">Query builder</h2>
          <p className="text-[13.5px] text-muted">Your sign, step by step. Each step is one moment: everything in it happens together.</p>
        </div>
        {(steps.length > 0 || hasStaged) && (
          <button type="button" className="btn btn-quiet !min-h-[38px] !px-2.5 text-[14px]" onClick={() => dispatch({ type: 'clearAll' })}><Icon name="trash" size={16} /> Clear</button>
        )}
      </div>

      <ol className="flex gap-2.5 overflow-x-auto pb-2 scroll-thin" aria-label="Committed steps">
        {steps.map((s, i) => (
          <li
            key={i} draggable
            onDragStart={() => setDragFrom(i)} onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragFrom != null && dragFrom !== i) dispatch({ type: 'moveStep', from: dragFrom, to: i }); setDragFrom(null); }}
            className={`w-[178px] shrink-0 rounded-xl border bg-surface2 p-2.5 ${editingIndex === i ? 'border-ink ring-1 ring-ink' : 'border-line'}`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-bold text-muted">Step {i + 1}</span>
              <span className="flex items-center">
                <button type="button" aria-label={`Move step ${i + 1} earlier`} disabled={i === 0} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface disabled:opacity-30" onClick={() => dispatch({ type: 'moveStep', from: i, to: i - 1 })}><Icon name="left" size={16} /></button>
                <button type="button" aria-label={`Move step ${i + 1} later`} disabled={i === steps.length - 1} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface disabled:opacity-30" onClick={() => dispatch({ type: 'moveStep', from: i, to: i + 1 })}><Icon name="right" size={16} /></button>
                <button type="button" aria-label={`Remove step ${i + 1}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface" onClick={() => dispatch({ type: 'removeStep', index: i })}><Icon name="x" size={16} /></button>
              </span>
            </div>
            <button type="button" className="block w-full rounded-lg text-left" onClick={() => dispatch({ type: 'loadStep', index: i })} aria-label={`Edit step ${i + 1}`}>
              <StepBadges step={s} vocab={vocab} />
              <span className="mt-1.5 block text-[12.5px] font-semibold text-muted">Tap to edit</span>
            </button>
          </li>
        ))}

        <li className="w-[220px] shrink-0 rounded-xl border-2 border-dashed border-hand/40 bg-hand/[0.04] p-2.5">
          <div className="mb-1.5 text-[13px] font-bold text-muted">{editing ? `Editing step ${editingIndex + 1}` : `Step ${steps.length + 1}`}</div>
          {hasStaged ? <StepBadges step={staged} vocab={vocab} /> : <p className="text-[13.5px] leading-snug text-muted">Tap a body part on the signer to set it, then add the step.</p>}
          <div className="mt-2.5 flex gap-2">
            <button type="button" className="btn btn-primary !min-h-[40px] flex-1 !px-2 text-[14px]" disabled={!hasStaged} onClick={() => dispatch({ type: 'commit' })}>{editing ? 'Update step' : 'Add step'}</button>
            {hasStaged && <button type="button" className="btn !min-h-[40px] !px-2.5 text-[14px]" onClick={() => dispatch({ type: 'clearStaged' })} aria-label="Discard this step"><Icon name="x" size={16} /></button>}
          </div>
        </li>
      </ol>
    </section>
  );
}
