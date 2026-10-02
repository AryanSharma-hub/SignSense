import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';

function Popover({ label, children, trigger }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn !min-h-[42px] !px-3 text-[14px]" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>{trigger}</button>
      {open && <div role="dialog" aria-label={label} className="absolute right-0 top-full z-40 mt-2 w-[min(92vw,380px)] rounded-2xl border border-line bg-surface p-4 shadow-lift">{children}</div>}
    </div>
  );
}

function Toggle({ label, hint, checked, disabled, onChange }) {
  return (
    <label className={`flex items-start gap-3 py-2 ${disabled ? 'opacity-60' : ''}`}>
      <input type="checkbox" className="mt-1 h-5 w-5 accent-[rgb(var(--hand))]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span><span className="block text-[15px] font-semibold leading-tight">{label}</span><span className="block text-[13px] text-muted">{hint}</span></span>
    </label>
  );
}

export function Header({ theme, onToggleTheme, flags, sttTier, reviewCount, total }) {
  const tierText = { native: 'Speech input: your browser', server: 'Speech input: server transcription', none: 'Speech input: typing only (no microphone support here)' }[sttTier];
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-hand text-on-accent">
          <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M9 21c0-6 2-10 7-10s7 4 7 10" /><circle cx="16" cy="8" r="0.5" /></svg>
        </span>
        <div>
          <h1 className="font-display text-[24px] font-semibold leading-none tracking-tight">SignSense</h1>
          <p className="text-[13.5px] text-muted">Sign in one direction, speech in the other.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {reviewCount > 0 && (
          <Popover label="About the sign data" trigger={<><Icon name="info" size={16} /> Draft sign data</>}>
            <h2 className="font-display text-[17px] font-semibold">Sign data is a draft</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
              {reviewCount} of {total} signs are marked <strong className="text-ink">needs review</strong>. The handshapes, movements and locations
              are placeholders to demonstrate the app, not verified ASL. Please don't rely on this for medical, legal or other
              important communication until an ASL-fluent reviewer has checked the data.
            </p>
          </Popover>
        )}
        <Popover label="Engines" trigger={<><Icon name="sliders" size={16} /> Engines</>}>
          <h2 className="font-display text-[17px] font-semibold">Optional AI assist</h2>
          <p className="mb-1 text-[13.5px] text-muted">Everything works without these. If one is unavailable, the built-in rules are used automatically.</p>
          <Toggle label="AI wording for your sentences" hint={flags.available.aiSentence ? 'Smoother English from your signs.' : 'Not configured on the server.'} checked={!!flags.user.aiSentence && flags.available.aiSentence} disabled={!flags.available.aiSentence} onChange={(v) => flags.set('aiSentence', v)} />
          <Toggle label="AI understanding of speech" hint={flags.available.aiConcepts ? 'Better with paraphrases and rephrasing.' : 'Not configured on the server.'} checked={!!flags.user.aiConcepts && flags.available.aiConcepts} disabled={!flags.available.aiConcepts} onChange={(v) => flags.set('aiConcepts', v)} />
          <Toggle label="Server speech recognition" hint={flags.available.serverStt ? 'Use instead of the browser’s built-in recognition.' : 'Not configured on the server.'} checked={!!flags.user.serverStt && flags.available.serverStt} disabled={!flags.available.serverStt} onChange={(v) => flags.set('serverStt', v)} />
          <p className="mt-2 border-t border-line pt-2 text-[13px] text-muted">{tierText}</p>
        </Popover>
        <button type="button" className="btn !min-h-[42px] !px-3" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  );
}
