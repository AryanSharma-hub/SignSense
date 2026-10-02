import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';

/**
 * Direction B input: the hearing person speaks (or types). Speech goes through the
 * tiered STT adapter; the transcript is analysed and performed on the shared signer.
 * Low-confidence speech is never guessed at — it asks to retry or correct the text.
 */
export function HearingReply({ reverse, stt, player }) {
  const [draft, setDraft] = useState('');
  const [fix, setFix] = useState('');
  useEffect(() => { if (reverse.status === 'lowConfidence') setFix(reverse.heard); }, [reverse.status, reverse.heard]);

  const listening = stt.status === 'listening';
  const busy = stt.status === 'transcribing' || reverse.processing;

  const send = () => { const t = draft.trim(); if (!t) return; setDraft(''); reverse.submit(t, { sttTier: 'typed' }); };

  let status = '';
  if (listening) status = 'Listening… speak now, then tap stop.';
  else if (stt.status === 'transcribing') status = 'Transcribing…';
  else if (reverse.processing) status = 'Working out the signs…';
  else if (player.performing && player.source === 'B') status = 'Signing their reply…';
  else if (reverse.status === 'done' && reverse.analysis && reverse.analysis.words.length === 0) status = 'No signs available for those words yet.';

  return (
    <div className="p-3">
      {reverse.status === 'lowConfidence' && (
        <div role="alert" className="mb-3 rounded-xl border border-expression/40 bg-expression/10 p-3">
          <p className="text-[15px] font-semibold">I didn't catch that clearly.</p>
          <p className="mb-2 text-[13.5px] text-muted">Nothing was signed, so the wrong sign isn't shown. Fix the words below, or try again.</p>
          <label className="sr-only" htmlFor="fix-text">What was said</label>
          <input id="fix-text" value={fix} onChange={(e) => setFix(e.target.value)} className="mb-2 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[17px]" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary !min-h-[42px]" disabled={!fix.trim()} onClick={() => reverse.submit(fix, { force: true, sttTier: 'corrected' })}>Use these words</button>
            <button type="button" className="btn !min-h-[42px]" disabled={!stt.supported} onClick={() => { reverse.reset(); stt.start(); }}><Icon name="mic" size={16} /> Try again</button>
            <button type="button" className="btn btn-quiet !min-h-[42px]" onClick={reverse.reset}>Cancel</button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2.5">
        <div className="relative shrink-0">
          <button
            type="button" disabled={!stt.supported || busy}
            onClick={listening ? stt.stop : stt.start}
            aria-label={listening ? 'Stop listening' : 'Speak to the signer'}
            className={`grid h-14 w-14 place-items-center rounded-full border-2 transition-colors disabled:opacity-40
              ${listening ? 'pulse-live border-live bg-live text-on-accent' : 'border-ink bg-ink text-bg hover:bg-ink/85'}`}
          >
            <Icon name={listening ? 'stop' : 'mic'} size={24} />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="typed-reply" className="field-label mb-1 block">Other person: speak or type</label>
          <div className="flex gap-2">
            <input
              id="typed-reply" value={listening && stt.interim ? stt.interim : draft} readOnly={listening}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
              placeholder={listening ? 'Listening…' : 'Type a message'}
              className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[17px] placeholder:text-muted/70"
            />
            <button type="button" className="btn btn-primary !min-h-[46px] !px-3.5" disabled={!draft.trim() || busy || listening} onClick={send} aria-label="Send"><Icon name="send" /></button>
          </div>
        </div>
      </div>

      <p className="mt-2 min-h-[1.25rem] text-[13px] text-muted" aria-live="polite">
        {stt.error || status || (stt.supported ? '' : 'Speech input is not available in this browser. You can type instead.')}
      </p>
    </div>
  );
}
