import { useCallback } from 'react';
import { TranslatorTools } from '../components/Header.jsx';
import { PageTools } from '../components/TopBar.jsx';
import { Stage } from '../components/Stage.jsx';
import { QueryBuilder } from '../components/QueryBuilder.jsx';
import { Suggestions } from '../components/Suggestions.jsx';
import { SentenceBuilder } from '../components/SentenceBuilder.jsx';
import { ConversationPanel } from '../components/Conversation.jsx';
import { HearingReply } from '../components/HearingReply.jsx';
import { Divider } from '../components/ui.jsx';
import { useVocabulary, useServerConfig } from '../api/hooks.js';
import { useComposer } from '../hooks/useComposer.js';
import { useStagePlayer } from '../hooks/useStagePlayer.js';
import { useConversation } from '../hooks/useConversation.js';
import { useReverseAssembler } from '../hooks/useReverseAssembler.js';
import { useSpeechToText } from '../hooks/useSpeechToText.js';
import { useFlags } from '../hooks/useFlags.js';
import { useResizable } from '../hooks/useResizable.js';

/** The two-way translator workspace: signer, builders, suggestions and conversation. */
export function TranslatorPage() {
  const voc = useVocabulary();
  const serverConfig = useServerConfig();
  const flags = useFlags(serverConfig.data);
  const conversation = useConversation();
  const player = useStagePlayer();
  const composer = useComposer(voc.vocab);

  // Direction B: hearing user's turn -> the shared conversation stream.
  const onHearingTurn = useCallback(({ analysis, confidence, sttTier }) => {
    conversation.add({
      from: 'hearing', text: analysis.transcript, parts: analysis.parts, unmatched: analysis.unmatched,
      words: analysis.words.map((w) => ({ gloss: w.gloss, signForm: w.signForm, via: w.via, needsReview: w.needsReview, provenance: w.provenance, spelled: w.spelled })),
      marker: analysis.marker, confidence, sttTier, tier: analysis.tier,
    });
  }, [conversation.add]); // eslint-disable-line react-hooks/exhaustive-deps

  const reverse = useReverseAssembler({
    vocab: voc.vocab, keywordIndex: voc.keywordIndex, useAi: flags.effective.aiConcepts,
    autoFingerspell: flags.effective.autoFingerspell, stage: player, onTurn: onHearingTurn,
  });
  const stt = useSpeechToText({
    serverAvailable: flags.available.serverStt, preferServer: flags.effective.serverStt,
    onFinal: (r) => reverse.submit(r.transcript, { confidence: r.confidence, sttTier: r.tier }),
  });

  // Resizable workspace: left and right column widths and the height of the builder row.
  // Sizes persist per browser (localStorage); each divider is also keyboard-adjustable.
  // Defaults scale with the screen so a 1366x768 laptop still gives the signer most of the space.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1600;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  const leftW = useResizable({ initial: vw < 1500 ? 290 : 340, min: 240, max: 560, axis: 'x', storageKey: 'signsense:grid:leftW' });
  const rightW = useResizable({ initial: vw < 1500 ? 330 : 380, min: 280, max: 600, axis: 'x', storageKey: 'signsense:grid:rightW', invert: true });
  const bottomH = useResizable({ initial: Math.round(Math.max(190, Math.min(320, vh * 0.3))), min: 170, max: 620, axis: 'y', storageKey: 'signsense:grid:bottomH', invert: true });

  const addWord = (g) => {
    composer.dispatch({ type: 'addWord', word: { gloss: g.gloss, meaning: g.meaning, pos: g.pos, english: g.english, signForm: g.signForm, provenance: g.source, needsReview: g.needsReview, nonManual: composer.currentNonManual() } });
    composer.dispatch({ type: 'clearAll' });
  };
  const onSay = ({ text, words, marker }) => {
    conversation.add({ from: 'signer', text, glosses: words.map((w) => w.gloss), words: words.map((w) => ({ gloss: w.gloss, signForm: w.signForm, provenance: w.provenance, needsReview: w.needsReview })), marker });
  };

  if (!voc.ready) {
    return (
      <div className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-6 text-center">
        {voc.error ? (
          <div className="panel p-6">
            <h2 className="font-display text-[22px] font-semibold">Can't reach the sign library</h2>
            <p className="mt-2 text-[15px] text-muted">The server didn't respond and there is no saved copy on this device yet. Check the connection and try again.</p>
            <button type="button" className="btn btn-primary mt-4" onClick={voc.refetch}>Try again</button>
          </div>
        ) : <p className="text-[16px] text-muted" role="status">Loading the sign library…</p>}
      </div>
    );
  }

  // While a Direction B turn is being processed or performed, Direction A's scaffolding steps back.
  const busyB = reverse.processing || (player.performing && player.source === 'B');

  return (
    <>
      <PageTools>
        <TranslatorTools flags={flags} sttTier={stt.tier} reviewCount={voc.reviewCount} total={voc.gestures.length} sources={voc.sources} />
      </PageTools>

      <div
        className="workspace"
        style={{ '--left-w': `${leftW.size}px`, '--right-w': `${rightW.size}px`, '--bottom-h': `${bottomH.size}px` }}
      >
        <div className={`ws-suggest scroll-thin transition-opacity ${busyB ? 'opacity-45' : ''}`} inert={busyB} aria-busy={busyB}>
          <Suggestions composer={composer} vocab={voc.vocab} gestures={voc.gestures} player={player} onAddWord={addWord} />
        </div>
        <div className="ws-div-left"><Divider axis="x" onDragStart={leftW.onDragStart} onNudge={leftW.nudge} label="Resize suggestions panel" /></div>

        <div className="ws-stage">
          <Stage composer={composer} vocab={voc.vocab} player={player} />
        </div>

        <div className="ws-div-right"><Divider axis="x" onDragStart={rightW.onDragStart} onNudge={(dir) => rightW.nudge(-dir)} label="Resize conversation panel" /></div>
        <div className="ws-convo">
          <ConversationPanel turns={conversation.turns} vocab={voc.vocab} player={player} onClear={conversation.clear}>
            <HearingReply reverse={reverse} stt={stt} player={player} />
          </ConversationPanel>
        </div>

        <div className="ws-div-bottom"><Divider axis="y" onDragStart={bottomH.onDragStart} onNudge={(dir) => bottomH.nudge(-dir)} label="Resize builder row" /></div>

        <div className={`ws-builder scroll-thin transition-opacity ${busyB ? 'opacity-45' : ''}`} inert={busyB} aria-busy={busyB}>
          <QueryBuilder composer={composer} vocab={voc.vocab} />
        </div>
        <div className={`ws-sentence scroll-thin transition-opacity ${busyB ? 'opacity-45' : ''}`} inert={busyB} aria-busy={busyB}>
          <SentenceBuilder composer={composer} vocab={voc.vocab} flags={flags.effective} player={player} onSay={onSay} />
        </div>
      </div>
    </>
  );
}
