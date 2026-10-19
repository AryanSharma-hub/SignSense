import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';

export function Popover({ label, children, trigger }) {
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
      <button type="button" className="btn !min-h-[38px] !px-2.5 text-[13.5px]" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>{trigger}</button>
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

/** The translator's page tools in the top bar: the sign-data notice and the Engines settings. */
export function TranslatorTools({ flags, sttTier, reviewCount, total, sources = {} }) {
  const tierText = { native: 'Speech input: your browser', server: 'Speech input: server transcription', none: 'Speech input: typing only (no microphone support here)' }[sttTier];
  const anyAi = flags.available.aiSentence || flags.available.aiConcepts;
  const fromLex = (sources['asl-lex'] || 0) + (sources.curated || 0);
  return (
      <>
        <Popover label="About the sign data" trigger={<><Icon name="info" size={16} /> Sign data{reviewCount > 0 ? ' · not yet reviewed' : ''}</>}>
          <h2 className="font-display text-[17px] font-semibold">About the sign data</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
            {total.toLocaleString()} American Sign Language (ASL) signs. <strong className="text-ink">{fromLex.toLocaleString()}</strong> take their
            handshape, hands used, movement shape and locations from{' '}
            <a className="underline" href="https://asl-lex.org/" target="_blank" rel="noreferrer">ASL-LEX 2.0</a>, a published lexical database of ASL,
            and are checked against it automatically.
            {sources.authored ? <> {sources.authored} common signs ASL-LEX lacks were written from standard ASL descriptions and are marked <strong className="text-ink">Authored</strong>.</> : null}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            ASL-LEX doesn't record movement direction, palm orientation or facial grammar, so those are approximated.
            {reviewCount > 0 && <> No sign has been reviewed by a fluent signer yet. Please don't rely on this for medical, legal or other important communication.</>}
            {' '}Words without a sign are never given an invented one: names and numbers are fingerspelled, and anything else is shown as unsigned.
          </p>
          <p className="mt-2 border-t border-line pt-2 text-[12.5px] text-muted">
            ASL-LEX 2.0: Caselli, Sehyr, Cohen-Goldberg &amp; Emmorey, used under CC BY-NC 4.0 (non-commercial).
          </p>
        </Popover>
        <Popover label="Engines" trigger={<><Icon name="sliders" size={16} /> Engines</>}>
          <h2 className="font-display text-[17px] font-semibold">Translation settings</h2>
          <Toggle label="Fingerspell names and numbers" hint="Names, places and numbers with no sign are spelled out letter by letter instead of left unsigned." checked={flags.effective.autoFingerspell} onChange={(v) => flags.set('autoFingerspell', v)} />
          {flags.available.serverStt && (
            <Toggle label="Server speech recognition" hint="Use instead of the browser’s built-in recognition." checked={!!flags.user.serverStt} onChange={(v) => flags.set('serverStt', v)} />
          )}
          {anyAi && (
            <>
              <p className="mt-2 border-t border-line pt-2 text-[13px] font-semibold text-muted">AI assist (configured on this server)</p>
              {flags.available.aiSentence && (
                <Toggle label="AI wording for your sentences" hint="Smoother English from your signs. Falls back to the built-in rules if unavailable." checked={!!flags.user.aiSentence} onChange={(v) => flags.set('aiSentence', v)} />
              )}
              {flags.available.aiConcepts && (
                <Toggle label="AI understanding of speech" hint="Better with paraphrases. Falls back to the built-in rules if unavailable." checked={!!flags.user.aiConcepts} onChange={(v) => flags.set('aiConcepts', v)} />
              )}
            </>
          )}
          <p className="mt-2 border-t border-line pt-2 text-[13px] text-muted">{tierText}</p>
        </Popover>
      </>
  );
}
