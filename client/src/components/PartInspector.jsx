import { OptionGrid, ParamChip, Icon, TONE, SourceBadge, provenanceOf } from './ui.jsx';
import { MovePad } from './ParameterPanels.jsx';
import { partLabel } from './SignerDummy.jsx';
import { expressiveHands } from '../lib/vocabulary.js';
import { describePose } from '../lib/pose.js';
import { describeMarker } from '../lib/nonManual.js';

/** Every body part the signer exposes, in the order they appear in the part bar. */
export const PARTS = [
  { k: 'E', label: 'Face' },
  { k: 'HD', label: 'Head' },
  { k: 'H', side: 'right', label: 'R hand' },
  { k: 'H', side: 'left', label: 'L hand' },
  { k: 'M', side: 'right', label: 'R move' },
  { k: 'M', side: 'left', label: 'L move' },
  { k: 'L', label: 'Body' },
];
const same = (a, b) => !!a && !!b && a.k === b.k && (a.side || null) === (b.side || null);
const HINT = {
  E: 'Facial expression for this step. Grammar markers (questions, negation) can also set it.',
  HD: 'Head position or movement for this step.',
  H: 'Handshape for this hand. Two-palm shapes set both hands together.',
  M: 'Direction or pattern this hand moves in. You can also drag the hand on the signer.',
  L: 'Where on the body the sign is made. Tap a dot on the signer or choose below. Leave unset for neutral space in front of the chest.',
};

/** Is this part already set on the step being built? Drives the dot on each part button. */
function filled(staged, p) {
  if (p.k === 'H' || p.k === 'M') return !!staged[p.k][p.side];
  return !!staged[p.k];
}

/**
 * The options for whichever body part is selected — the same choice the user makes by
 * tapping that part on the signer. It sits beside (or below) the figure, never over it.
 */
export function PartInspector({ composer, vocab, part, onPart }) {
  const { staged, dispatch } = composer;

  return (
    <div className="flex min-h-0 flex-col">
      <div role="group" aria-label="Body parts" className="flex flex-wrap gap-1">
        {PARTS.map((p) => {
          const on = same(p, part);
          return (
            <button
              key={`${p.k}-${p.side || ''}`} type="button" aria-pressed={on}
              aria-label={`${partLabel(p).split(' — ')[0]} options`} title={partLabel(p)}
              onClick={() => onPart(on ? null : p)}
              className={`relative min-h-[34px] rounded-lg border px-2 text-[12.5px] font-semibold transition-colors ${on ? TONE[p.k].solid : 'border-line bg-surface hover:bg-surface2'}`}
            >
              {p.label}
              {filled(staged, p) && <span aria-hidden className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-surface ${TONE[p.k].dot}`} />}
            </button>
          );
        })}
      </div>

      {!part ? (
        <div className="mt-3 rounded-xl border border-dashed border-line px-3 py-4 text-[13.5px] leading-relaxed text-muted">
          <p className="font-semibold text-ink">Tap any part of the signer.</p>
          <p className="mt-1">The face gives expressions, the hair gives head movements, a hand gives handshapes, an arm gives movements, and the body gives locations. Its options open here.</p>
        </div>
      ) : (
        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className={`text-[14.5px] font-bold ${TONE[part.k].text}`}>{partLabel(part).split(' — ')[0]}</h3>
            <button type="button" className="btn btn-quiet !min-h-[30px] !px-1.5" onClick={() => onPart(null)} aria-label="Close options"><Icon name="x" size={16} /></button>
          </div>
          <p className="mb-2 text-[12.5px] leading-snug text-muted">{HINT[part.k]}</p>
          <div className="scroll-thin -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
            {part.k === 'E' && <OptionGrid k="E" items={vocab.expressions} selected={[staged.E]} onPick={(id) => dispatch({ type: 'setE', id })} cols="grid-cols-2" />}
            {part.k === 'HD' && <OptionGrid k="HD" items={vocab.heads} selected={[staged.HD]} onPick={(id) => dispatch({ type: 'setHD', id })} cols="grid-cols-2" />}
            {part.k === 'H' && (
              <OptionGrid
                k="H" hands items={expressiveHands(vocab)} selected={[staged.H[part.side]]} cols="grid-cols-2"
                onPick={(id) => { dispatch({ type: 'setActiveHand', side: part.side }); dispatch({ type: 'setH', id, side: part.side }); }}
              />
            )}
            {part.k === 'M' && (
              <MovePad
                vocab={vocab} selected={[staged.M[part.side]].filter(Boolean)}
                onPick={(id) => { dispatch({ type: 'setActiveHand', side: part.side }); dispatch({ type: 'setM', id, side: part.side }); }}
              />
            )}
            {part.k === 'L' && <OptionGrid k="L" items={vocab.locations} selected={[staged.L]} onPick={(id) => dispatch({ type: 'setL', id })} cols="grid-cols-2" />}
          </div>
        </div>
      )}
    </div>
  );
}

/** While a performance runs, the inspector shows what is being signed, and lets you jump to any word. */
export function NowSigning({ player, vocab }) {
  const marker = describeMarker(player.marker, vocab);
  const pose = player.pose ? describePose(player.pose, vocab) : '';
  const current = player.words?.[player.word];
  return (
    <div className="flex min-h-0 flex-col">
      <p className="field-label">Now signing</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-2"><span className="gloss text-[22px] leading-tight">{player.label || '…'}</span>{current && <SourceBadge sign={current} />}</p>
      <p className="text-[13px] text-muted">Step {Math.max(1, player.step + 1)} of {Math.max(1, player.steps)}{player.count > 1 ? ` · word ${player.word + 1} of ${player.count}` : ''}</p>
      {current?.spelled && <p className="mt-2 text-[12.5px] text-muted">Fingerspelled: no sign for this word, so it is spelled letter by letter.</p>}
      {provenanceOf(current) === 'authored' && (
        <p className="mt-2 rounded-lg border border-expression/40 bg-expression/10 px-2 py-1 text-[12.5px] text-ink">Authored sign: not in ASL-LEX, written from standard ASL descriptions. Needs review by a fluent signer.</p>
      )}
      {(provenanceOf(current) === 'asl-lex' || provenanceOf(current) === 'curated') && (
        <p className="mt-2 text-[12.5px] leading-snug text-muted">Hands, movement shape and locations follow ASL-LEX; direction and palm orientation are approximate.</p>
      )}
      {pose && (
        <div className="mt-3 flex flex-wrap gap-1">
          {pose.split(' · ').map((p) => <ParamChip key={p} k={p.startsWith('Face') ? 'E' : p.startsWith('Head') ? 'HD' : p.startsWith('Location') ? 'L' : p.includes('ovement') ? 'M' : 'H'}>{p}</ParamChip>)}
        </div>
      )}
      {marker && <p className="mt-2 text-[13px] font-semibold text-muted">Face and head: {marker}</p>}
      {player.count > 1 && (
        <>
          <p className="field-label mb-1 mt-4">Jump to a word</p>
          <ol className="scroll-thin flex min-h-0 flex-wrap gap-1.5 overflow-y-auto" aria-label="Words in this performance">
            {player.words.map((w, i) => (
              <li key={`${w.gloss}-${i}`}>
                <button
                  type="button" aria-current={i === player.word ? 'step' : undefined} onClick={() => player.jumpToWord(i)}
                  className={`chip !py-0.5 text-[13px] ${i === player.word ? 'border-hand bg-hand text-on-accent' : 'border-line bg-surface hover:bg-surface2'}`}
                ><span className="gloss">{w.gloss}</span></button>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
