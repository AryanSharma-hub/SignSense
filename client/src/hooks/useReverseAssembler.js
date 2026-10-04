import { useCallback, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { speechToGloss } from '../lib/speechToGloss/index.js';
import { isLowConfidence } from '../lib/stt/index.js';

const IDLE = { status: 'idle', heard: '', confidence: null, analysis: null };

/**
 * Direction B controller: transcript -> analysis -> performance on the shared stage.
 * Low-confidence speech is NOT guessed at: the hearing user is asked to retry or correct
 * the text, and nothing is performed until it is clear.
 */
export function useReverseAssembler({ vocab, keywordIndex, useAi, autoFingerspell = true, stage, onTurn }) {
  const [state, setState] = useState(IDLE);
  const latest = useRef({});
  latest.current = { vocab, keywordIndex, useAi, autoFingerspell, stage, onTurn };

  const submit = useCallback(async (transcript, { confidence = null, sttTier = 'typed', force = false } = {}) => {
    const text = String(transcript || '').trim();
    if (!text) return;
    if (!force && isLowConfidence(confidence)) { setState({ status: 'lowConfidence', heard: text, confidence, analysis: null }); return; }
    setState({ status: 'processing', heard: text, confidence, analysis: null });
    const { vocab: v, keywordIndex: index, useAi: ai, autoFingerspell: spell } = latest.current;
    const analysis = await speechToGloss(text, { index, vocab: v, useAi: ai, api, autoFingerspell: spell });
    setState({ status: 'done', heard: text, confidence, analysis });
    latest.current.onTurn?.({ analysis, confidence, sttTier });
    if (analysis.words.length) await latest.current.stage.perform(analysis.words, { marker: analysis.marker, label: 'Speech', source: 'B' });
  }, []);

  const reset = useCallback(() => setState(IDLE), []);
  return { ...state, processing: state.status === 'processing', submit, reset };
}
