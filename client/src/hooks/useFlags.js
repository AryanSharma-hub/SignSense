import { useCallback, useMemo, useState } from 'react';

const KEY = 'signsense:flags';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

/**
 * Optional tiers are off by default. A tier is ON only if the person turned it on
 * AND the server says it is configured — otherwise the deterministic default answers.
 */
export function useFlags(serverConfig) {
  const [user, setUser] = useState(read);
  const available = useMemo(() => ({
    aiSentence: !!serverConfig?.ai?.sentence,
    aiConcepts: !!serverConfig?.ai?.concepts,
    serverStt: !!serverConfig?.stt?.server,
  }), [serverConfig]);
  const set = useCallback((name, value) => {
    setUser((u) => { const n = { ...u, [name]: value }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignore */ } return n; });
  }, []);
  const effective = useMemo(() => ({
    aiSentence: !!user.aiSentence && available.aiSentence,
    aiConcepts: !!user.aiConcepts && available.aiConcepts,
    serverStt: !!user.serverStt && available.serverStt,
    // Purely client-side (no server gate), so it defaults ON unless the person turns it off.
    autoFingerspell: user.autoFingerspell !== false,
  }), [user, available]);
  return { user, available, effective, set };
}
