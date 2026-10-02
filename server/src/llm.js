import { config } from './config.js';

/** Minimal Anthropic Messages API call. The key never leaves the server. */
export async function complete({ system, user, maxTokens = 300 }) {
  if (!config.anthropicKey) {
    const err = new Error('AI tier is not configured on this server.');
    err.status = 503;
    throw err;
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.llmModel,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = new Error(`LLM request failed (${res.status})`);
    err.status = 502;
    throw err;
  }
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

/** Pull the first JSON object out of a model reply (tolerates code fences / preamble). */
export function extractJson(text) {
  const cleaned = String(text).replace(/```json|```/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in model reply');
  return JSON.parse(cleaned.slice(start, end + 1));
}
