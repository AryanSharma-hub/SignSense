import { useEffect, useState } from 'react';
import { Icon, Segmented } from './ui.jsx';
import { sentenceAssembler } from '../lib/sentenceAssembler/index.js';
import { describeMarker } from '../lib/nonManual.js';
import { speak, isSpeechSupported } from '../lib/speak.js';
import { api } from '../api/client.js';

/**
 * Direction A output. Signs are collected as chips (drag or use the arrows to reorder);
 * the sentence assembler turns them into English, with the signer's face/head marker
 * (question, negation) shaping the grammar. The text stays editable.
 */
export function SentenceBuilder({ composer, vocab, flags, player, onSay }) {
  const { words, marker, markerMode, dispatch } = composer;
  const [text, setText] = useState('');
  const [edited, setEdited] = useState(false);
  const [meta, setMeta] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);

  useEffect(() => {
    let alive = true;
    if (words.length === 0) { setText(''); setEdited(false); setMeta(null); return undefined; }
    const input = {
      words: words.map((w) => ({ gloss: w.gloss, pos: w.pos, english: w.english, meaning: w.meaning })),
      marker: { type: marker.type, negated: marker.negated },
    };
    sentenceAssembler(input, { useAi: flags.aiSentence, api }).then((r) => {
      if (!alive) return;
      setText(r.text); setEdited(false); setMeta(r);
    });
    return () => { alive = false; };
  }, [words, marker.type, marker.negated, flags.aiSentence]);

  const say = () => {
    if (!text.trim()) return;
    speak(text);
    onSay({ text: text.trim(), words, marker });
    dispatch({ type: 'clearWords' });
    dispatch({ type: 'clearAll' });
  };
  const preview = () => player.perform(words, { marker, label: 'your sentence', source: 'A' });

  const autoNote = markerMode === 'auto' && describeMarker(marker, vocab) ? `Detected from your face and head: ${describeMarker(marker, vocab)}.` : null;

  return (
    <section className="panel min-h-full p-3.5" aria-label="Your sentence">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="font-display text-[18px] font-semibold tracking-tight">Sentence builder</h2>
          <p className="text-[13px] text-muted">Add signs in order, then say it aloud to the conversation.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="field-label">Grammar</span>
          <Segmented
            label="Sentence type" value={markerMode} onChange={(mode) => dispatch({ type: 'setMarkerMode', mode })}
            options={[{ value: 'auto', label: 'Auto' }, { value: 'statement', label: 'Statement' }, { value: 'question', label: 'Question' }, { value: 'negation', label: 'Negation' }]}
          />
        </div>
      </div>

      <div className="sentence-grid">
        <div className="min-w-0">
          <p className="field-label mb-1.5">Signs in order</p>
          {words.length === 0 ? (
            <p className="rounded-xl bg-surface2 px-3 py-3 text-[14px] text-muted">Signs you add from Suggestions collect here.</p>
          ) : (
            <ol className="flex flex-wrap gap-2" aria-label="Signs in your sentence">
              {words.map((w, i) => (
                <li
                  key={w.key} draggable onDragStart={() => setDragFrom(i)} onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragFrom != null && dragFrom !== i) dispatch({ type: 'moveWord', from: dragFrom, to: i }); setDragFrom(null); }}
                  className="flex items-center rounded-xl border border-line bg-surface2 pl-1.5"
                >
                  <button type="button" aria-label={`Move ${w.gloss} earlier`} disabled={i === 0} className="grid h-9 w-7 place-items-center text-muted disabled:opacity-25" onClick={() => dispatch({ type: 'moveWord', from: i, to: i - 1 })}><Icon name="left" size={14} /></button>
                  <span className="gloss px-1 text-[16px]">{w.gloss}</span>
                  <button type="button" aria-label={`Move ${w.gloss} later`} disabled={i === words.length - 1} className="grid h-9 w-7 place-items-center text-muted disabled:opacity-25" onClick={() => dispatch({ type: 'moveWord', from: i, to: i + 1 })}><Icon name="right" size={14} /></button>
                  <button type="button" aria-label={`Play ${w.gloss}`} disabled={player.performing} className="grid h-9 w-8 place-items-center text-muted hover:text-ink disabled:opacity-25" onClick={() => player.perform([w], { label: w.gloss, source: 'A' })}><Icon name="play" size={12} /></button>
                  <button type="button" aria-label={`Remove ${w.gloss}`} className="grid h-9 w-9 place-items-center rounded-r-xl text-muted hover:bg-surface" onClick={() => dispatch({ type: 'removeWord', key: w.key })}><Icon name="x" size={15} /></button>
                </li>
              ))}
            </ol>
          )}
          {autoNote && <p className="mt-2 text-[13px] text-muted">{autoNote}</p>}
        </div>

        <div className="min-w-0">
          <label className="field-label mb-1 block" htmlFor="assembled">What to say</label>
          <textarea
            id="assembled" rows={2} value={text} disabled={words.length === 0}
            onChange={(e) => { setText(e.target.value); setEdited(true); }}
            placeholder="The sentence appears here as you add signs."
            className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-[17px] leading-snug placeholder:text-muted/70"
          />
          <p className="mt-1 min-h-[1.25rem] text-[12.5px] text-muted" aria-live="polite">
            {meta?.fellBack ? 'AI wording was unavailable, so the built-in rules wrote this. ' : ''}
            {meta && !meta.fellBack ? (meta.tier === 'ai' ? 'Worded with AI assist. ' : 'Built with the built-in grammar rules. ') : ''}
            {edited ? 'You edited this text.' : 'You can edit it before saying it.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary !min-h-[40px]" disabled={!text.trim()} onClick={say}>
              <Icon name="speaker" /> {isSpeechSupported() ? 'Say it' : 'Add to conversation'}
            </button>
            <button type="button" className="btn !min-h-[40px]" disabled={words.length === 0 || player.performing} onClick={preview}><Icon name="play" size={15} /> Preview signing</button>
            {words.length > 0 && <button type="button" className="btn btn-quiet !min-h-[40px]" onClick={() => dispatch({ type: 'clearWords' })}>Clear</button>}
          </div>
        </div>
      </div>
    </section>
  );
}
