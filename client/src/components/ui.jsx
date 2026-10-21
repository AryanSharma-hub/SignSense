import { HandGlyph } from './HandShape.jsx';

/** One hue per parameter. Full class strings so Tailwind's scanner sees them. */
export const TONE = {
  E:  { name: 'Face',     text: 'text-expression', soft: 'bg-expression/10 border-expression/35 text-expression', solid: 'bg-expression text-on-accent border-expression', dot: 'bg-expression' },
  H:  { name: 'Hand',     text: 'text-hand',       soft: 'bg-hand/10 border-hand/35 text-hand',                   solid: 'bg-hand text-on-accent border-hand',             dot: 'bg-hand' },
  M:  { name: 'Movement', text: 'text-movement',   soft: 'bg-movement/10 border-movement/35 text-movement',       solid: 'bg-movement text-on-accent border-movement',     dot: 'bg-movement' },
  HD: { name: 'Head',     text: 'text-head',       soft: 'bg-head/10 border-head/35 text-head',                   solid: 'bg-head text-on-accent border-head',             dot: 'bg-head' },
  L:  { name: 'Location', text: 'text-location',   soft: 'bg-location/10 border-location/35 text-location',       solid: 'bg-location text-on-accent border-location',     dot: 'bg-location' },
};

const PROVENANCE = new Set(['curated', 'asl-lex', 'authored']);
/** Where a sign's data comes from. Words from speech carry it as `provenance`; gestures as `source`. */
export const provenanceOf = (w) => w?.provenance ?? (PROVENANCE.has(w?.source) ? w.source : null);

/** Small badge saying where a sign's data comes from, and how far it can be trusted. */
export function SourceBadge({ sign, className = '' }) {
  const p = provenanceOf(sign);
  if (!p) return null;
  const authored = p === 'authored';
  return (
    <span
      title={authored
        ? 'Not in ASL-LEX: written from standard ASL descriptions. Needs review by a fluent signer.'
        : 'Handshape, hands, movement shape and locations from ASL-LEX 2.0, checked against it. Movement direction and palm orientation are approximate; not yet reviewed by a fluent signer.'}
      className={`rounded-md border px-1.5 py-0.5 text-[11.5px] font-semibold ${authored ? 'border-expression/45 bg-expression/10 text-expression' : 'border-line text-muted'} ${className}`}
    >{authored ? 'Authored' : 'ASL-LEX'}</span>
  );
}

export function ParamChip({ k, children, title }) {
  return <span title={title} className={`inline-flex max-w-full items-center truncate rounded-md border px-1.5 py-0.5 text-[12.5px] font-semibold leading-tight ${TONE[k].soft}`}>{children}</span>;
}

/** Grid of selectable parameter values: emoji for faces/heads, drawn hands for handshapes. */
export function OptionGrid({ k, items, selected = [], onPick, cols = 'grid-cols-2 sm:grid-cols-3', hands = false }) {
  const t = TONE[k];
  return (
    <div className={`grid gap-2 ${cols}`}>
      {items.map((it) => {
        const on = selected.includes(it.id);
        return (
          <button
            key={it.id} type="button" onClick={() => onPick(it.id)} aria-pressed={on}
            className={`flex min-h-[56px] items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-[14.5px] font-medium leading-tight transition-colors
              ${on ? t.solid : 'border-line bg-surface hover:bg-surface2'}`}
          >
            {hands
              ? <span className={`shrink-0 ${on ? 'opacity-100' : ''}`}><HandGlyph shape={it.shape} size={30} /></span>
              : it.glyph ? <span aria-hidden className="shrink-0 text-[22px] leading-none">{it.glyph}</span> : <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${on ? 'bg-on-accent' : t.dot}`} />}
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A LeetCode-style draggable divider between two resizable panes. */
export function Divider({ axis = 'x', onDragStart, onNudge, label }) {
  return (
    <div
      role="separator" aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'} aria-label={label} tabIndex={0}
      onPointerDown={onDragStart}
      onKeyDown={(e) => {
        const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp', fwd = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
        if (e.key === back) { e.preventDefault(); onNudge(-1); }
        else if (e.key === fwd) { e.preventDefault(); onNudge(1); }
      }}
      className={`group relative shrink-0 touch-none ${axis === 'x' ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize'}`}
    >
      <div className={`absolute bg-line transition-colors group-hover:bg-hand/60 group-focus-visible:bg-hand
        ${axis === 'x' ? 'inset-y-0 left-1/2 w-px -translate-x-1/2' : 'inset-x-0 top-1/2 h-px -translate-y-1/2'}`}
      />
    </div>
  );
}

export function Segmented({ value, onChange, options, label, tone = 'bg-accent text-on-accent shadow-glow' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-surface2 p-1">
      {options.map((o) => (
        <button
          key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`min-h-[38px] rounded-lg px-3 text-[14px] font-semibold transition-colors ${value === o.value ? tone : 'text-muted hover:text-ink'}`}
        >{o.label}</button>
      ))}
    </div>
  );
}

const paths = {
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0M12 18v3',
  stop: 'M7 7h10v10H7z',
  play: 'M8 5.5v13l11-6.5z',
  x: 'M6 6l12 12M18 6L6 18',
  send: 'M4 12l16-7-6 16-3-6.5z',
  sun: 'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  speaker: 'M5 10v4h3.5l4.5 3.5v-11L8.5 10zM16 9a4 4 0 0 1 0 6',
  replay: 'M4 12a8 8 0 1 0 2.4-5.7M4 5v4.5h4.5',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M13 4v6M7 14v6',
  info: 'M12 8v.01M11 12h1v5h1M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z',
  trash: 'M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12',
  pause: 'M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z',
  skipBack: 'M17 6l-6 6 6 6M7 6v12',
  skipFwd: 'M7 6l6 6-6 6M17 6v12',
  route: 'M6 19.5a1.5 1.5 0 1 0 0-.01M18 4.5a1.5 1.5 0 1 0 0-.01M7.5 19h7a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7h7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  hand: 'M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.5a5.5 5.5 0 0 1-4.6-2.5L4.5 15a1.5 1.5 0 0 1 2.4-1.8L8 14.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20M8 7h8',
  chart: 'M4 20h16M7 16v-5M12 16V7M17 16v-8',
  chat: 'M4 5h16v11H9l-5 4z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  check: 'M5 12.5l4.5 4.5L19 7',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
};
export function Icon({ name, size = 18, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={name === 'stop' || name === 'play' || name === 'pause' || name === 'star-filled' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={paths[name]} />
    </svg>
  );
}
