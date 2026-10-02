import { isNativeSupported } from './nativeTier.js';
import { isServerRecorderSupported } from './serverTier.js';

/** Below this the app says "didn't catch that clearly" instead of guessing at a sign. */
export const LOW_CONFIDENCE = 0.55;
export const isLowConfidence = (c) => typeof c === 'number' && c < LOW_CONFIDENCE;

/**
 * Same tiered idea as the other adapters: native browser recognition is the default;
 * the server tier is used when the person opts in, or when the browser has no native STT.
 * @returns {'native'|'server'|'none'}
 */
export function selectSttTier({ serverAvailable, preferServer }) {
  const native = isNativeSupported();
  const server = serverAvailable && isServerRecorderSupported();
  if (server && (preferServer || !native)) return 'server';
  if (native) return 'native';
  return 'none';
}
