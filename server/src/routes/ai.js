import { Router } from 'express';
import { complete, extractJson } from '../llm.js';
import { getKeywordVocabulary } from '../db/queries.js';

const NON_MANUAL = new Set(['statement', 'question', 'negation', 'imperative']);
const clip = (s, n) => String(s ?? '').slice(0, n);

export function aiRoutes(db) {
  const r = Router();

  // Sign -> English: turn an ordered gloss sequence (+ face/head marker) into a natural sentence.
  r.post('/sentence', async (req, res) => {
    const words = Array.isArray(req.body?.words) ? req.body.words.slice(0, 24) : null;
    if (!words || words.length === 0) return res.status(400).json({ error: 'words[] is required.' });
    const marker = NON_MANUAL.has(req.body?.marker) ? req.body.marker : 'statement';
    const payload = {
      glosses: words.map((w) => ({ gloss: clip(w.gloss, 40), meaning: clip(w.meaning, 160) })),
      marker,
    };
    const text = await complete({
      maxTokens: 120,
      system:
        'You are the sentence-assembly step of an accessibility app that helps a Deaf signer talk with a hearing person. ' +
        'You receive the ASL glosses the person signed, in order, plus a grammatical marker made with the face and head ' +
        '(statement, question, negation, or imperative). Write ONE short, natural English sentence or fragment a hearing ' +
        'person would say for those signs. Rules: express only what the glosses mean and never add facts, names or requests ' +
        'that were not signed; adding articles, auxiliaries and pronouns is fine; if the marker is "question" write a ' +
        'question; if "negation" negate the main predicate; a lone interjection stays a lone interjection. ' +
        'Reply with the sentence only — no quotes, no explanation.',
      user: JSON.stringify(payload),
    });
    res.json({ text: clip(text.replace(/^["']|["']$/g, ''), 400) });
  });

  // Speech -> sign: normalized concept keywords for a transcript.
  r.post('/concepts', async (req, res) => {
    const transcript = clip(req.body?.transcript, 400).trim();
    if (!transcript) return res.status(400).json({ error: 'transcript is required.' });
    const vocabulary = await getKeywordVocabulary(db);
    const reply = await complete({
      maxTokens: 200,
      system:
        'You are the concept-extraction step of an accessibility app that turns a hearing person\'s speech into sign language. ' +
        'Given a transcript and the vocabulary of signs the app has, return the content concepts of the sentence in the order ' +
        'they occur. Rules: drop function words (articles, auxiliaries, prepositions); reduce words to their base form; ' +
        'when a concept clearly means one of the vocabulary keywords, return that keyword exactly; otherwise return the ' +
        'concept\'s base-form word as-is and NEVER force a match; handle paraphrases ("I\'d like some water" and "give me ' +
        'water" both give want, water); do not invent concepts that are not in the transcript. ' +
        'Reply with JSON only, exactly like {"concepts":["want","water"]}.',
      user: JSON.stringify({ transcript, vocabulary }),
    });
    const parsed = extractJson(reply);
    const concepts = (Array.isArray(parsed.concepts) ? parsed.concepts : [])
      .filter((c) => typeof c === 'string')
      .map((c) => clip(c, 40).toLowerCase().trim())
      .filter(Boolean)
      .slice(0, 24);
    res.json({ concepts });
  });

  return r;
}
