/**
 * Optional AI tier: the backend-proxied LLM returns normalized concept keywords directly,
 * which handles paraphrase far better than stopword stripping ("I'd like some water" and
 * "give me water" both give want + water). Only extraction differs by tier — mapping to
 * gestures is the shared matcher.
 */
export async function extractConceptsAi(transcript, api) {
  const res = await api.post('/ai/concepts', { transcript });
  const concepts = Array.isArray(res?.concepts) ? res.concepts.filter((c) => typeof c === 'string' && c.trim()) : [];
  if (concepts.length === 0) throw new Error('AI returned no concepts');
  return concepts;
}
