import express, { Router } from 'express';
import { config } from '../config.js';

/**
 * Server-side speech-to-text tier. Accepts a raw audio body (MediaRecorder output)
 * and forwards it to any OpenAI-compatible /audio/transcriptions endpoint.
 * Returns {transcript, confidence}; confidence is derived from segment log-probs.
 */
export function sttRoutes() {
  const r = Router();
  r.post('/', express.raw({ type: () => true, limit: '12mb' }), async (req, res) => {
    if (!config.sttKey) return res.status(503).json({ error: 'Server speech-to-text is not configured.' });
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length < 400) return res.status(400).json({ error: 'No audio received.' });

    const mime = (req.headers['content-type'] || 'audio/webm').split(';')[0];
    const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm';
    const form = new FormData();
    form.append('file', new Blob([buf], { type: mime }), `speech.${ext}`);
    form.append('model', config.sttModel);
    form.append('language', 'en');
    form.append('response_format', 'verbose_json');

    const upstream = await fetch(`${config.sttBaseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.sttKey}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok) return res.status(502).json({ error: `Transcription failed (${upstream.status}).` });
    const data = await upstream.json();

    const segs = Array.isArray(data.segments) ? data.segments : [];
    // Whisper tends to hallucinate short phrases on silence; treat "probably no speech" as empty.
    const silent = segs.length > 0 && segs.every((s) => (s.no_speech_prob ?? 0) > 0.6);
    let confidence = null;
    if (segs.length) {
      const mean = segs.reduce((a, s) => a + (s.avg_logprob ?? -1), 0) / segs.length;
      confidence = Math.max(0, Math.min(1, Math.exp(mean)));
    }
    res.json({ transcript: silent ? '' : String(data.text || '').trim(), confidence });
  });
  return r;
}
