import { runTiered } from '../tiered.js';
import { assembleDeterministic } from './deterministic.js';
import { assembleAi } from './aiTier.js';

/**
 * sentenceAssembler — sign -> English, two tiers behind one interface.
 *   default: deterministic rules (offline)   optional: backend-proxied LLM (feature flag)
 * @returns {Promise<{text:string, tier:string, fellBack:boolean, error?:string}>}
 */
export async function sentenceAssembler(input, { useAi = false, api } = {}) {
  const res = await runTiered({
    useAi: useAi && !!api,
    deterministic: () => assembleDeterministic(input),
    ai: () => assembleAi(input, api),
  });
  return { text: res.value, tier: res.tier, fellBack: res.fellBack, error: res.error };
}

export { assembleDeterministic };
