import { useState } from 'react';
import { OptionGrid, Segmented, Icon, TONE } from './ui.jsx';

const GRID = [['NW', 'N', 'NE'], ['W', 'CENTER', 'E'], ['SW', 'S', 'SE']];
const ARROW = { N: '↑', NE: '↗', E: '→', SE: '↘', S: '↓', SW: '↙', W: '←', NW: '↖', CENTER: '•' };

/** Abstract compass picker for movement (the accessible, non-drag way to set it). */
function MovePad({ vocab, selected, onPick }) {
  const byDir = (d) => vocab.movements.find((m) => m.dir === d);
  const patterns = vocab.movements.filter((m) => m.dir === 'PATTERN');
  const cell = (m, d) => {
    if (!m) return <span key={d} />;
    const on = selected.includes(m.id);
    return (
      <button
        key={m.id} type="button" aria-pressed={on} onClick={() => onPick(m.id)}
        className={`flex min-h-[64px] flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 text-center text-[13px] font-semibold leading-tight
          ${on ? TONE.M.solid : 'border-line bg-surface hover:bg-surface2'}`}
      >
        <span className="text-[20px] leading-none" aria-hidden>{ARROW[d]}</span>
        <span className="mt-0.5">{m.label}</span>
      </button>
    );
  };
  return (
    <div>
      <div className="grid max-w-[420px] grid-cols-3 gap-2">{GRID.flat().map((d) => cell(byDir(d), d))}</div>
      {patterns.length > 0 && (
        <>
          <p className="field-label mb-1.5 mt-3">Patterns</p>
          <div className="flex flex-wrap gap-2">
            {patterns.map((m) => {
              const on = selected.includes(m.id);
              return (
                <button key={m.id} type="button" aria-pressed={on} onClick={() => onPick(m.id)}
                  className={`min-h-[44px] rounded-xl border px-3 text-[14px] font-semibold ${on ? TONE.M.solid : 'border-line bg-surface hover:bg-surface2'}`}>{m.label}</button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const TABS = [['E', 'Face'], ['H', 'Hands'], ['M', 'Movement'], ['HD', 'Head'], ['L', 'Location']];
const OPEN_KEY = 'signsense:precise-open';

/**
 * The collapsed, accessible fallback for everything the stage does by dragging and tapping.
 * Every control here is a real button, reachable by keyboard and screen reader.
 */
export function ParameterPanels({ composer, vocab }) {
  const { staged, activeHand, dispatch } = composer;
  const [tab, setTab] = useState('H');
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; } });
  const toggle = (e) => { const v = e.currentTarget.open; setOpen(v); try { localStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch { /* ignore */ } };

  const selM = [staged.M[activeHand], staged.M.right && staged.M.right === staged.M.left ? staged.M.right : null].filter(Boolean);

  return (
    <details className="panel group" open={open} onToggle={toggle}>
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5">
          <Icon name="sliders" />
          <span>
            <span className="block text-[15.5px] font-semibold leading-tight">Precise controls</span>
            <span className="block text-[13px] text-muted">Keyboard and screen-reader friendly — no dragging needed</span>
          </span>
        </span>
        <span className="text-[13px] font-semibold text-muted group-open:hidden">Show</span>
        <span className="hidden text-[13px] font-semibold text-muted group-open:inline">Hide</span>
      </summary>

      <div className="border-t border-line px-4 pb-4 pt-3">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Parameter" className="flex flex-wrap gap-1.5">
            {TABS.map(([k, label]) => (
              <button
                key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`min-h-[40px] rounded-lg border px-3 text-[14px] font-semibold ${tab === k ? TONE[k].solid : `border-line bg-surface hover:bg-surface2`}`}
              >{label}</button>
            ))}
          </div>
          {(tab === 'H' || tab === 'M') && (
            <Segmented label="Which hand to edit" value={activeHand} onChange={(side) => dispatch({ type: 'setActiveHand', side })}
              options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />
          )}
        </div>

        {tab === 'E' && <OptionGrid k="E" items={vocab.expressions} selected={[staged.E]} onPick={(id) => dispatch({ type: 'setE', id })} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />}
        {tab === 'H' && <OptionGrid k="H" hands items={vocab.hands} selected={[staged.H[activeHand]]} onPick={(id) => dispatch({ type: 'setH', id, side: activeHand })} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />}
        {tab === 'M' && <MovePad vocab={vocab} selected={selM} onPick={(id) => dispatch({ type: 'setM', id, side: activeHand })} />}
        {tab === 'HD' && <OptionGrid k="HD" items={vocab.heads} selected={[staged.HD]} onPick={(id) => dispatch({ type: 'setHD', id })} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />}
        {tab === 'L' && (
          <>
            <p className="mb-2 text-[13.5px] text-muted">Where on the body the sign is made. Leave unset for the neutral chest position.</p>
            <OptionGrid k="L" items={vocab.locations} selected={[staged.L]} onPick={(id) => dispatch({ type: 'setL', id })} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
          </>
        )}
      </div>
    </details>
  );
}
