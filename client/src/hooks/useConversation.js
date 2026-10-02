import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'signsense:conversation';
const MAX_TURNS = 120;
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch { return []; } };

/**
 * The unified transcript: signer turns and hearing turns in one replayable stream.
 * Kept on-device (localStorage) so a closed tab doesn't lose the exchange; cleared on request.
 * Each turn stores its signForms so replay needs no re-analysis.
 */
export function useConversation() {
  const [turns, setTurns] = useState(read);
  const n = useRef(turns.length);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(turns.slice(-MAX_TURNS))); } catch { /* ignore */ }
  }, [turns]);

  const add = useCallback((turn) => {
    n.current += 1;
    setTurns((t) => [...t, { id: `t${Date.now()}-${n.current}`, ts: Date.now(), ...turn }].slice(-MAX_TURNS));
  }, []);
  const clear = useCallback(() => setTurns([]), []);
  return { turns, add, clear };
}
