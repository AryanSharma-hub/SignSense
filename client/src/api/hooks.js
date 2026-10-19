import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './client.js';
import { buildVocab, EMPTY_PARAMS } from '../lib/vocabulary.js';
import { buildKeywordIndex } from '../lib/speechToGloss/matcher.js';
import { flattenStepsFlat } from '../lib/steps.js';

// The vocabulary is cached in localStorage so the app still opens with no connection —
// a communication aid should not go blank because the network dropped.
const snapshot = {
  read(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : undefined; } catch { return undefined; } },
  write(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* storage full / blocked */ } },
};

const cachedFetch = (key, path) => async () => {
  const data = await api.get(path);
  snapshot.write(key, data);
  return data;
};

const STALE = 5 * 60 * 1000;

export function useParameters() {
  return useQuery({
    queryKey: ['parameters'], queryFn: cachedFetch('signsense:parameters', '/parameters'),
    staleTime: STALE, initialData: snapshot.read('signsense:parameters'), initialDataUpdatedAt: 0,
  });
}
export function useGestures() {
  return useQuery({
    queryKey: ['gestures'], queryFn: cachedFetch('signsense:gestures', '/gestures'),
    staleTime: STALE, initialData: snapshot.read('signsense:gestures'), initialDataUpdatedAt: 0,
  });
}
export function useServerConfig() {
  return useQuery({ queryKey: ['config'], queryFn: () => api.get('/config'), staleTime: STALE, retry: 1 });
}

/** Everything the UI needs from the database, derived once and memoized. */
export function useVocabulary() {
  const p = useParameters();
  const g = useGestures();
  const vocab = useMemo(() => buildVocab(p.data || EMPTY_PARAMS), [p.data]);
  const gestures = useMemo(
    () => (g.data?.gestures || []).map((x) => ({ ...x, flat: flattenStepsFlat(x.signForm) })),
    [g.data]);
  const keywordIndex = useMemo(() => buildKeywordIndex(gestures), [gestures]);
  const ready = !!p.data && !!g.data;
  const reviewCount = useMemo(
    () => gestures.filter((x) => x.needsReview).length, [gestures]);
  /** How many signs come from each source (curated / asl-lex / authored) — shown in the data notice. */
  const sources = useMemo(() => {
    const out = {};
    for (const x of gestures) { const k = x.source || 'unknown'; out[k] = (out[k] || 0) + 1; }
    return out;
  }, [gestures]);
  return { vocab, gestures, keywordIndex, ready, error: p.error || g.error, isLoading: p.isLoading || g.isLoading, reviewCount, sources, refetch: () => { p.refetch(); g.refetch(); } };
}
