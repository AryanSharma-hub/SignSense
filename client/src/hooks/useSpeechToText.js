import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { selectSttTier } from '../lib/stt/index.js';
import { createNativeRecognizer } from '../lib/stt/nativeTier.js';
import { createServerRecorder } from '../lib/stt/serverTier.js';

/**
 * Hearing-user speech input. Tier = native browser recognition by default, or server
 * transcription when opted in / when the browser has none. `tier === 'none'` means the
 * UI should offer typing only.
 */
export function useSpeechToText({ serverAvailable, preferServer, onFinal }) {
  const tier = useMemo(() => selectSttTier({ serverAvailable, preferServer }), [serverAvailable, preferServer]);
  const [status, setStatus] = useState('idle'); // idle | listening | transcribing
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const handle = useRef(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  const start = useCallback(async () => {
    setError(''); setInterim('');
    try {
      if (tier === 'native') {
        const rec = createNativeRecognizer({
          onInterim: setInterim,
          onFinal: (r) => finalRef.current?.(r),
          onError: (m) => setError(m),
          onEnd: () => setStatus('idle'),
        });
        handle.current = rec;
        rec.start();
        setStatus('listening');
      } else if (tier === 'server') {
        const rec = createServerRecorder({
          api, onState: setStatus, onError: (m) => setError(m), onFinal: (r) => finalRef.current?.(r),
        });
        handle.current = rec;
        await rec.start();
      }
    } catch {
      setStatus('idle');
      setError('Could not start the microphone. You can type instead.');
    }
  }, [tier]);

  const stop = useCallback(() => { handle.current?.stop?.(); }, []);
  useEffect(() => () => handle.current?.abort?.(), []);

  return { tier, status, interim, error, start, stop, supported: tier !== 'none' };
}
