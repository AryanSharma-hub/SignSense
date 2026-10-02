/** Default STT tier: the browser's built-in SpeechRecognition (no server involved). */
const Ctor = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);

export const isNativeSupported = () => !!Ctor();

const ERRORS = {
  'not-allowed': 'Microphone access was blocked. Allow it in your browser settings, or type instead.',
  'service-not-allowed': 'Speech recognition is not allowed here. You can type instead.',
  'no-speech': "I didn't hear anything. Try again, or type instead.",
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition lost its connection. Try again, or type instead.',
};

/**
 * @param {{onInterim(text), onFinal({transcript, confidence, tier}), onError(msg), onEnd()}} cb
 */
export function createNativeRecognizer(cb, lang = 'en-US') {
  const SR = Ctor();
  if (!SR) throw new Error('SpeechRecognition unsupported');
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText = '', finalConf = [], gotFinal = false, failed = false;
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) { finalText += r[0].transcript; finalConf.push(r[0].confidence); gotFinal = true; }
      else interim += r[0].transcript;
    }
    cb.onInterim?.((finalText + interim).trim());
  };
  rec.onerror = (e) => {
    if (e.error === 'aborted') return;
    failed = true;
    cb.onError?.(ERRORS[e.error] || `Speech recognition error (${e.error}).`);
  };
  rec.onend = () => {
    if (gotFinal && finalText.trim() && !failed) {
      // Some engines report 0 / undefined confidence when they simply don't know: treat as unknown.
      const known = finalConf.filter((c) => typeof c === 'number' && c > 0);
      const confidence = known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
      cb.onFinal?.({ transcript: finalText.trim(), confidence, tier: 'native' });
    } else if (!failed) cb.onError?.(ERRORS['no-speech']);
    cb.onEnd?.();
  };
  return { start: () => rec.start(), stop: () => rec.stop(), abort: () => rec.abort() };
}
