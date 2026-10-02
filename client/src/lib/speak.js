/** Text-to-speech for Direction A output (browser speechSynthesis). */
export const isSpeechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text, { onEnd } = {}) {
  if (!isSpeechSupported() || !text) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}
export const stopSpeaking = () => { if (isSpeechSupported()) window.speechSynthesis.cancel(); };
