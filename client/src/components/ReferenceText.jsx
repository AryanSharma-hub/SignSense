import { describeMarker } from '../lib/nonManual.js';

/**
 * The hearing user's words, annotated so nothing disappears silently:
 *   matched   -> underlined, with the sign it became
 *   spelled   -> dashed underline, fingerspelled letter by letter (no sign exists for it)
 *   function  -> dimmed (grammar words with no sign of their own)
 *   marker    -> italic (carried by face/head instead of a sign, e.g. "not")
 *   unmatched -> struck through, and listed as "no sign available"
 */
export function ReferenceText({ analysis, vocab, compact = false }) {
  const { parts, words = [], unmatched = [], marker } = analysis;
  const markerText = describeMarker(marker, vocab);

  return (
    <div className="space-y-2">
      <p className={`leading-relaxed ${compact ? 'text-[16px]' : 'text-[19px]'}`}>
        {parts
          ? parts.map((p, i) => {
            if (p.type === 'gap') return <span key={i}>{p.text}</span>;
            if (p.role === 'matched') {
              return (
                <span key={i}>
                  <span className="rounded-sm bg-hand/12 font-semibold underline decoration-hand decoration-2 underline-offset-4">{p.text}</span>
                  {p.groupEnd && <sup className="ml-0.5 text-[11px] font-bold text-hand">{p.gloss}</sup>}
                </span>
              );
            }
            if (p.role === 'spelled') {
              return (
                <span key={i}>
                  <span className="rounded-sm bg-location/12 font-semibold underline decoration-location decoration-dashed decoration-2 underline-offset-4" title="No sign for this word — fingerspelled letter by letter">{p.text}</span>
                  {p.groupEnd && <sup className="ml-0.5 text-[11px] font-bold text-location">spelled</sup>}
                </span>
              );
            }
            if (p.role === 'unmatched') return <span key={i} className="text-live line-through decoration-2" title="No sign available">{p.text}</span>;
            if (p.role === 'marker') return <span key={i} className="italic text-head" title="Shown with the face and head">{p.text}</span>;
            return <span key={i} className="text-muted">{p.text}</span>;
          })
          : analysis.transcript}
      </p>

      {words.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5" aria-label="Signs">
          {words.map((w, i) => (
            w.spelled ? (
              <span key={`${w.gloss}-${i}`} className="chip border-dashed border-location/40 bg-location/10 font-mono text-location" title="Fingerspelled — no single sign for this word">
                <span className="gloss">{w.gloss.split('').join('-')}</span>
              </span>
            ) : (
              <span key={`${w.gloss}-${i}`} className="chip border-hand/35 bg-hand/10 text-hand" title={w.provenance === 'authored' ? 'Authored sign: not in ASL-LEX, needs review by a fluent signer' : w.needsReview ? 'From ASL-LEX 2.0: not yet reviewed by a fluent signer' : undefined}>
                <span className="gloss">{w.gloss}</span>
              </span>
            )
          ))}
        </p>
      )}
      {markerText && <p className="text-[13.5px] font-semibold text-head">Face and head: {markerText}</p>}
      {unmatched.length > 0 && (
        <p className="text-[13.5px] font-semibold text-live">
          No sign available for: {unmatched.map((u) => u.text).join(', ')}
        </p>
      )}
      {words.length === 0 && (
        <p className="text-[13.5px] font-semibold text-live">None of these words have a sign in the app yet, so nothing was signed.</p>
      )}
    </div>
  );
}
