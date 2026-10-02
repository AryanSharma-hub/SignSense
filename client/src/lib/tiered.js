/**
 * THE tiered-adapter pattern, stated once and applied everywhere.
 *
 * Any capability that depends on an external / variable-quality service is built as
 *   - a deterministic, fully-offline-capable DEFAULT tier, and
 *   - an optional AI/network tier behind a feature flag,
 * both behind the same interface. If the optional tier is off, unavailable, or fails,
 * the deterministic tier answers — the app never depends on the network to work.
 *
 * Used by: sentenceAssembler (sign->English), speechToGloss concept extraction
 * (speech->sign), and the speech-to-text tier selector.
 *
 * @returns {Promise<{value:any, tier:'deterministic'|'ai', fellBack:boolean, error?:string}>}
 */
export async function runTiered({ deterministic, ai, useAi = false }) {
  if (useAi && ai) {
    try {
      return { value: await ai(), tier: 'ai', fellBack: false };
    } catch (err) {
      const value = await deterministic();
      return { value, tier: 'deterministic', fellBack: true, error: err?.message || 'AI tier failed' };
    }
  }
  return { value: await deterministic(), tier: 'deterministic', fellBack: false };
}
