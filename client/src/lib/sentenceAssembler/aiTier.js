/** Optional AI tier: the backend proxies an LLM (the API key never reaches the browser). */
export async function assembleAi({ words, marker }, api) {
  const res = await api.post('/ai/sentence', {
    words: words.map((w) => ({ gloss: w.gloss, meaning: w.meaning })),
    marker: marker?.type === 'wh-question' ? 'question' : marker?.type || 'statement',
  });
  const text = String(res?.text || '').trim();
  if (!text) throw new Error('Empty AI reply');
  return text;
}
