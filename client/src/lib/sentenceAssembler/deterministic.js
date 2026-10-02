/**
 * Deterministic sign -> English assembly. Rule-based, offline, predictable.
 *
 * Input:  words  [{gloss, pos, english}]   (pos/english come from the gestures table)
 *         marker {type: 'statement'|'question'|'negation'|'imperative', negated?}
 * Output: a sentence string.
 *
 * It is deliberately conservative: it may add articles-free glue words (subject "I",
 * "do", "not", "to") but never content. The signer can always edit the result.
 */

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const isVerb = (t) => t.pos === 'verb';
const isInterj = (t) => t.pos === 'interj';
const isPron = (t) => t.pos === 'pronoun';

function toTokens(words) {
  return words.map((w) => ({
    pos: w.pos || 'noun',
    gloss: w.gloss,
    en: (w.english || String(w.gloss).toLowerCase()).trim(),
  }));
}

/** Object-position pronouns: "I" -> "me". */
const asObject = (t) => (t.en === 'I' ? 'me' : t.en);

/** Adverbs (MORE) read before the noun/adjective they modify: [WATER, MORE] -> "more water". */
function orderPhrase(tokens) {
  const adv = tokens.filter((t) => t.pos === 'adv');
  const rest = tokens.filter((t) => t.pos !== 'adv');
  return [...adv, ...rest];
}

/** Interjections group into their own comma-separated segments: "No, thank you." */
function joinSegments(tokens, textOf = (t) => t.en) {
  const segments = [];
  let current = null;
  for (const t of tokens) {
    const kind = isInterj(t) ? 'i' : 'c';
    // Content words group together; every interjection is its own segment, except that
    // "please" attaches to the interjection before it ("Yes please").
    const attach = current && current.kind === kind && (kind === 'c' || t.en === 'please');
    if (!attach) { current = { kind, parts: [] }; segments.push(current); }
    current.parts.push(textOf(t));
  }
  return segments.map((s) => s.parts.join(' ')).join(', ');
}

function fragment(tokens, { question, negated }) {
  const lone = tokens.length === 1 && isInterj(tokens[0]);
  if (negated && !lone) {
    // no verb to negate: adjectives/adverbs take "not", nouns take "no"
    const idx = tokens.findIndex((t) => t.pos === 'adj' || t.pos === 'adv' || t.pos === 'noun');
    if (idx !== -1) {
      const t = tokens[idx];
      const copy = tokens.slice();
      copy.splice(idx, 1, { ...t, en: `${t.pos === 'noun' ? 'no' : 'not'} ${t.en}` });
      return finish(joinSegments(copy), question ? '?' : '.');
    }
  }
  // "please" trails a bare fragment: "More water, please."
  const pleaseIdx = tokens.findIndex((t) => t.en === 'please');
  if (pleaseIdx !== -1 && tokens.length > 1 && tokens.some((t) => !isInterj(t))) {
    const rest = orderPhrase(tokens.filter((_, i) => i !== pleaseIdx));
    return finish(`${joinSegments(rest)}, please`, question ? '?' : '.');
  }
  return finish(joinSegments(orderPhrase(tokens)), question ? '?' : '.');
}

function finish(text, punct) { return cap(text.trim()) + punct; }

export function assembleDeterministic({ words, marker }) {
  if (!words || words.length === 0) return '';
  const tokens = toTokens(words);
  const type = marker?.type || 'statement';
  const question = type === 'question' || type === 'wh-question';
  const negated = !!marker?.negated || type === 'negation';
  const imperative = type === 'imperative';

  const vi = tokens.findIndex(isVerb);
  if (vi === -1) return fragment(tokens, { question, negated });

  const verbTok = tokens[vi];
  const beforeVerb = tokens.slice(0, vi);
  const afterVerb = tokens.slice(vi + 1);

  const greetings = beforeVerb.filter(isInterj);
  const subjectToks = beforeVerb.filter(isPron);
  // Topic-comment order (WATER WANT): nouns/adjectives before the verb become its object.
  const fronted = beforeVerb.filter((t) => !isInterj(t) && !isPron(t));

  const trailingInterj = afterVerb.filter(isInterj);
  const laterVerbs = afterVerb.filter(isVerb);
  const objects = orderPhrase([...fronted, ...afterVerb.filter((t) => !isInterj(t) && !isVerb(t))]);

  const subject = subjectToks.length ? subjectToks.map((t) => t.en).join(' ') : null;
  const verbEn = verbTok.en;
  const objectText = objects.map(asObject).join(' ');
  const laterText = laterVerbs.map((v) => (verbEn === 'want' ? `to ${v.en}` : `and ${v.en}`)).join(' ');

  // Verb-only "help" reads as a call for help, not "I help".
  const bareHelp = verbEn === 'help' && !subject && objects.length === 0 && laterVerbs.length === 0 && !question && !negated;

  let clause;
  if (question) {
    if (verbEn === 'want' && subject === 'I') clause = `can I have ${objectText}`;
    else if (verbEn === 'help' && !subject) clause = `can you help ${objectText}`;
    else clause = `do ${subject ?? 'you'} ${negated ? 'not ' : ''}${verbEn} ${laterText} ${objectText}`;
  } else if (negated) {
    clause = `${imperative || (!subject && verbEn === 'help') ? 'do not' : `${subject ?? 'I'} do not`} ${verbEn} ${laterText} ${objectText}`;
  } else if (imperative || bareHelp) {
    clause = `${verbEn} ${laterText} ${objectText}`;
  } else {
    clause = `${subject ?? 'I'} ${verbEn} ${laterText} ${objectText}`;
  }
  clause = clause.replace(/\s+/g, ' ').trim();

  let text = clause;
  if (greetings.length) text = `${greetings.map((t) => t.en).join(' ')}, ${text}`;
  if (trailingInterj.length) {
    const tail = trailingInterj.map((t) => t.en).join(' ');
    // "Help, please." / "Eat, thank you."
    text = `${text}, ${tail}`;
  }
  const punct = question ? '?' : bareHelp ? '!' : '.';
  return finish(text, punct);
}
