import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';
import { ReferenceText } from './ReferenceText.jsx';

function Turn({ turn, vocab, player }) {
  const mine = turn.from === 'signer';
  const words = mine ? turn.words : turn.words;
  const replay = () => player.perform(words, { marker: turn.marker, label: mine ? 'your sentence' : 'their reply', source: mine ? 'A' : 'B' });
  const time = new Date(turn.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <li className={`turn-in flex ${mine ? 'justify-start' : 'justify-end'}`}>
      <article className={`max-w-[94%] rounded-2xl border px-3.5 py-3 ${mine ? 'border-hand/30 bg-hand/[0.07]' : 'border-line bg-surface2'}`}>
        <header className="mb-1 flex items-center justify-between gap-3">
          <span className={`text-[13px] font-bold ${mine ? 'text-hand' : 'text-muted'}`}>{mine ? 'You signed' : 'They said'} <span className="font-medium text-muted">· {time}</span></span>
          {words?.length > 0 && (
            <button type="button" className="btn btn-quiet !min-h-[34px] !px-2 text-[13px]" onClick={replay} disabled={player.performing} aria-label={`Replay ${mine ? 'your' : 'their'} message`}>
              <Icon name="replay" size={15} /> Replay
            </button>
          )}
        </header>
        {mine ? (
          <>
            <p className="text-[19px] leading-snug">{turn.text}</p>
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {turn.glosses.map((g, i) => <span key={i} className="chip border-hand/35 bg-hand/10 !py-0.5 text-[13px] text-hand"><span className="gloss">{g}</span></span>)}
            </p>
          </>
        ) : (
          <ReferenceText compact vocab={vocab} analysis={{ transcript: turn.text, parts: turn.parts, words: turn.words, unmatched: turn.unmatched, marker: turn.marker }} />
        )}
      </article>
    </li>
  );
}

/** One replayable stream for both directions. */
export function ConversationPanel({ turns, vocab, player, onClear, children }) {
  const end = useRef(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [turns.length]);

  return (
    <section className="panel convo-panel flex flex-col overflow-hidden" aria-label="Conversation">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="font-display text-[18px] font-semibold tracking-tight">Conversation</h2>
        {turns.length > 0 && (confirming
          ? (
            <span className="flex items-center gap-1.5 text-[13.5px]">
              <span className="text-muted">Clear all?</span>
              <button type="button" className="btn !min-h-[36px] !px-2.5 text-[13.5px]" onClick={() => { onClear(); setConfirming(false); }}>Yes, clear</button>
              <button type="button" className="btn btn-quiet !min-h-[36px] !px-2.5 text-[13.5px]" onClick={() => setConfirming(false)}>Keep</button>
            </span>
          )
          : <button type="button" className="btn btn-quiet !min-h-[36px] !px-2.5 text-[13.5px]" onClick={() => setConfirming(true)}><Icon name="trash" size={15} /> Clear</button>)}
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto px-3 py-3">
        {turns.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <p className="max-w-[30ch] text-[15px] leading-relaxed text-muted">Nothing here yet. Sign something and say it aloud, or have the other person speak or type below. Both sides appear here, and any message can be replayed.</p>
          </div>
        ) : (
          <ol role="log" aria-live="polite" className="space-y-3">
            {turns.map((t) => <Turn key={t.id} turn={t} vocab={vocab} player={player} />)}
          </ol>
        )}
        <div ref={end} />
      </div>
      <div className="border-t border-line bg-surface">{children}</div>
    </section>
  );
}
