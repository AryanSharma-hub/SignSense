/** Optional STT tier: record with MediaRecorder, transcribe via the backend (/api/stt). */
export const isServerRecorderSupported = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

const MAX_MS = 15000;

export function createServerRecorder({ api, onState, onFinal, onError }) {
  let recorder = null, stream = null, timer = null, chunks = [];

  const cleanup = () => { clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); stream = null; recorder = null; };

  return {
    async start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        onError?.('Microphone access was blocked. Allow it in your browser settings, or type instead.');
        return;
      }
      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
        cleanup();
        onState?.('transcribing');
        try {
          const res = await api.postAudio('/stt', blob);
          if (!res.transcript) onError?.("I didn't hear anything. Try again, or type instead.");
          else onFinal?.({ transcript: res.transcript, confidence: res.confidence ?? null, tier: 'server' });
        } catch (err) {
          onError?.(err.status === 503 ? 'Server transcription is not configured.' : 'Transcription failed. Try again, or type instead.');
        }
        onState?.('idle');
      };
      recorder.start();
      onState?.('listening');
      timer = setTimeout(() => this.stop(), MAX_MS);
    },
    stop() { if (recorder && recorder.state !== 'inactive') recorder.stop(); },
    abort() { if (recorder) { recorder.onstop = null; if (recorder.state !== 'inactive') recorder.stop(); } cleanup(); onState?.('idle'); },
  };
}
