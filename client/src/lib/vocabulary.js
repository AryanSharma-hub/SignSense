/**
 * Vocabulary = the parameter tables fetched from the database, indexed by id.
 * Param keys keep the v1 names:  E expression · H hand · M movement · HD head · L location
 */
export const PARAM_TABLE = {
  E: 'expressions',
  H: 'hands',
  M: 'movements',
  HD: 'heads',
  L: 'locations',
};

export const EMPTY_PARAMS = { expressions: [], hands: [], movements: [], heads: [], locations: [] };

export function buildVocab(params = EMPTY_PARAMS) {
  const vocab = { ...EMPTY_PARAMS, ...params, index: {} };
  for (const [key, table] of Object.entries(PARAM_TABLE)) {
    vocab.index[key] = new Map((vocab[table] || []).map((row) => [row.id, row]));
  }
  return vocab;
}

/** byId(vocab, 'H', 'H05') -> the row, or null. */
export function byId(vocab, key, id) {
  if (!id || !vocab?.index?.[key]) return null;
  return vocab.index[key].get(id) ?? null;
}

/** Handshapes a sign is built from: the real ASL handshape categories. Excludes the
 * fingerspelling letters/digits (picked only from the Spell tab) and the retired 'legacy'
 * descriptive shapes, which no sign uses any more. */
export function expressiveHands(vocab) {
  return (vocab?.hands || []).filter((h) => {
    const f = String(h.family || '');
    return !f.startsWith('fingerspell') && f !== 'legacy';
  });
}

/** The 26 letters + 10 digits, for the fingerspelling picker. */
export function fingerspellHands(vocab) {
  return (vocab?.hands || []).filter((h) => String(h.family || '').startsWith('fingerspell'));
}
