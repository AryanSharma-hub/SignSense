import { HandGlyph } from './HandShape.jsx';

/** One hue per parameter. Full class strings so Tailwind's scanner sees them. */
export const TONE = {
  E:  { name: 'Face',     text: 'text-expression', soft: 'bg-expression/10 border-expression/35 text-expression', solid: 'bg-expression text-on-accent border-expression', dot: 'bg-expression' },
  H:  { name: 'Hand',     text: 'text-hand',       soft: 'bg-hand/10 border-hand/35 text-hand',                   solid: 'bg-hand text-on-accent border-hand',             dot: 'bg-hand' },
  M:  { name: 'Movement', text: 'text-movement',   soft: 'bg-movement/10 border-movement/35 text-movement',       solid: 'bg-movement text-on-accent border-movement',     dot: 'bg-movement' },
  HD: { name: 'Head',     text: 'text-head',       soft: 'bg-head/10 border-head/35 text-head',                   solid: 'bg-head text-on-accent border-head',             dot: 'bg-head' },
  L:  { name: 'Location', text: 'text-location',   soft: 'bg-location/10 border-location/35 text-location',       solid: 'bg-location text-on-accent border-location',     dot: 'bg-location' },
};

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

export function Segmented({ value, onChange, options, label, tone = 'bg-ink text-bg' }) {
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
};
export function Icon({ name, size = 18, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={name === 'stop' || name === 'play' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={paths[name]} />
    </svg>
  );
}
