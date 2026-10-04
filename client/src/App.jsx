import { useCallback } from 'react';
import { Header } from './components/Header.jsx';
import { Stage } from './components/Stage.jsx';
import { ParameterPanels } from './components/ParameterPanels.jsx';
import { StepsBar } from './components/StepsBar.jsx';
import { Suggestions } from './components/Suggestions.jsx';
import { SentenceBuilder } from './components/SentenceBuilder.jsx';
import { ConversationPanel } from './components/Conversation.jsx';
import { HearingReply } from './components/HearingReply.jsx';
import { Divider } from './components/ui.jsx';
import { useVocabulary, useServerConfig } from './api/hooks.js';
import { useComposer } from './hooks/useComposer.js';
import { useStagePlayer } from './hooks/useStagePlayer.js';
import { useConversation } from './hooks/useConversation.js';
import { useReverseAssembler } from './hooks/useReverseAssembler.js';
import { useSpeechToText } from './hooks/useSpeechToText.js';
import { useFlags } from './hooks/useFlags.js';
import { useTheme } from './hooks/useTheme.js';
import { useResizable } from './hooks/useResizable.js';

export default function App() {
  const voc = useVocabulary();
  const serverConfig = useServerConfig();
  const flags = useFlags(serverConfig.data);
  const { theme, toggle } = useTheme();
  const conversation = useConversation();
  const player = useStagePlayer();
  const composer = useComposer(voc.vocab);

  // Direction B: hearing user's turn -> the shared conversation stream.
  const onHearingTurn = useCallback(({ analysis, confidence, sttTier }) => {
    conversation.add({
      from: 'hearing', text: analysis.transcript, parts: analysis.parts, unmatched: analysis.unmatched,
      words: analysis.words.map((w) => ({ gloss: w.gloss, signForm: w.signForm, via: w.via, needsReview: w.needsReview })),
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

  // LeetCode-style resizable split: left/right column widths, and the top/bottom split
  // within each column. Sizes persist per browser (localStorage), independent sliders.
  const leftW = useResizable({ initial: 400, min: 280, max: 640, axis: 'x', storageKey: 'signsense:split:leftW' });
  const rightW = useResizable({ initial: 400, min: 280, max: 640, axis: 'x', storageKey: 'signsense:split:rightW', invert: true });
  const resultsH = useResizable({ initial: 360, min: 140, max: 1200, axis: 'y', storageKey: 'signsense:split:resultsH' });
  const chatH = useResizable({ initial: 360, min: 160, max: 1200, axis: 'y', storageKey: 'signsense:split:chatH' });

  const addWord = (g) => {
    composer.dispatch({ type: 'addWord', word: { gloss: g.gloss, meaning: g.meaning, pos: g.pos, english: g.english, signForm: g.signForm, nonManual: composer.currentNonManual() } });
    composer.dispatch({ type: 'clearAll' });
  };
  const onSay = ({ text, words, marker }) => {
    conversation.add({ from: 'signer', text, glosses: words.map((w) => w.gloss), words: words.map((w) => ({ gloss: w.gloss, signForm: w.signForm })), marker });
  };

  if (!voc.ready) {
    return (
      <div className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-6 text-center">
        {voc.error ? (
          <div className="panel p-6">
            <h1 className="font-display text-[22px] font-semibold">Can't reach the sign library</h1>
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
    <div className="app-shell mx-auto max-w-[1680px] px-3 pb-10 pt-3 sm:px-5">
      <Header theme={theme} onToggleTheme={toggle} flags={flags} sttTier={stt.tier} reviewCount={voc.reviewCount} total={voc.gestures.length} />

      <main className="app-grid mt-4">
        <div className="split-col" style={{ '--split-w': `${leftW.size}px` }}>
          <div
            className={`split-pane split-pane-top scroll-thin transition-opacity ${busyB ? 'opacity-45' : ''}`}
            style={{ '--pane-h': `${resultsH.size}px` }} inert={busyB} aria-busy={busyB}
          >
            <Suggestions composer={composer} vocab={voc.vocab} gestures={voc.gestures} player={player} onAddWord={addWord} />
          </div>
          <Divider axis="y" onDragStart={resultsH.onDragStart} onNudge={resultsH.nudge} label="Resize Query Results" />
          <div
            className={`split-pane split-pane-bottom scroll-thin space-y-4 transition-opacity ${busyB ? 'opacity-45' : ''}`}
            inert={busyB} aria-busy={busyB}
          >
            <StepsBar composer={composer} vocab={voc.vocab} />
            <ParameterPanels composer={composer} vocab={voc.vocab} />
          </div>
        </div>

        <Divider axis="x" onDragStart={leftW.onDragStart} onNudge={leftW.nudge} label="Resize left panel" />

        <div className="area-stage">
          <Stage composer={composer} vocab={voc.vocab} player={player} />
        </div>

        <Divider axis="x" onDragStart={rightW.onDragStart} onNudge={(dir) => rightW.nudge(-dir)} label="Resize right panel" />

        <div className="split-col" style={{ '--split-w': `${rightW.size}px` }}>
          <div className="split-pane split-pane-top" style={{ '--pane-h': `${chatH.size}px` }}>
            <ConversationPanel turns={conversation.turns} vocab={voc.vocab} player={player} onClear={conversation.clear}>
              <HearingReply reverse={reverse} stt={stt} player={player} />
            </ConversationPanel>
          </div>
          <Divider axis="y" onDragStart={chatH.onDragStart} onNudge={chatH.nudge} label="Resize ChatBox" />
          <div
            className={`split-pane split-pane-bottom scroll-thin transition-opacity ${busyB ? 'opacity-45' : ''}`}
            inert={busyB} aria-busy={busyB}
          >
            <SentenceBuilder composer={composer} vocab={voc.vocab} flags={flags.effective} player={player} onSay={onSay} />
          </div>
        </div>
      </main>
    </div>
  );
}
