/**
 * Loads the real ASL-LEX 2.0 dataset (signdata.csv, downloaded from the project's OSF
 * repository — see ATTRIBUTION.md) and turns it into gesture entries using this app's
 * step shape, via the handshape/location/movement maps in this directory.
 *
 * What is taken from the data, per sign:
 *   - dominant handshape, and a handshape CHANGE when one is coded (HandshapeM2)
 *   - sign type -> whether the other hand takes part, with which handshape, and whether it moves
 *   - movement shape and repetition
 *   - start location, and the END location when the sign travels (SecondMinorLocation)
 *   - lexical class (part of speech), and which English word(s) it translates to
 *   - sign frequency (how familiar the sign is to signers, 1-7), kept for ranking/reporting
 * What is NOT in the data and therefore not invented: movement direction, palm
 * orientation, facial expression (citation-form neutral face is used).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aslLexHandRows, handshapeIdFor } from './handshapeMap.js';
import { aslLexLocationRows, locationIdFor } from './locationMap.js';
import { aslLexMovementRows, movementIdFor } from './movementMap.js';
import { GRAMMAR_WORDS, SAME_SIGN_SYNONYMS, GLOSS_OVERRIDES, PRONOUNS } from '../wordLists.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Minimal CSV parser (quoted-field aware) — the real file has commas inside quoted text. */
function parseCSV(text) {
  const rows = []; let row = []; let field = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

let cachedRows = null;
/** Every ASL-LEX row as an object keyed by the CSV header (cached; the file is ~5 MB). */
export function loadAslLexRows() {
  if (cachedRows) return cachedRows;
  const text = fs.readFileSync(path.join(here, 'signdata.csv'), 'utf8');
  const parsed = parseCSV(text);
  const header = parsed[0];
  cachedRows = parsed.slice(1)
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
  return cachedRows;
}

export const baseLemma = (s) => String(s || '').trim().replace(/_\d+$/, '').toLowerCase();
const isSuffixed = (s) => /_\d+$/.test(String(s || '').trim());
const freq = (row) => { const f = Number(row['SignFrequency(M)']); return Number.isFinite(f) ? f : null; };
const coded = (v) => !!v && v !== 'NA';

const CLASS_POS = { Noun: 'noun', Verb: 'verb', Adjective: 'adj', Adverb: 'adv', Number: 'adj', Name: 'noun' };
const CLASS_LABEL = { Noun: 'noun', Verb: 'verb', Adjective: 'adjective', Adverb: 'adverb', Number: 'number', Name: 'name', Minor: 'other sense' };

/** The most familiar row first (highest sign frequency), unsuffixed EntryIDs breaking ties. */
const byFamiliarity = (a, b) => (freq(b) ?? -1) - (freq(a) ?? -1) || Number(isSuffixed(a.EntryID)) - Number(isSuffixed(b.EntryID));

/**
 * Group ASL-LEX rows into SIGN MEANINGS. Rows share a meaning when they share a base lemma
 * AND a lexical class: "eat_1"/"eat_2" (both verbs) are variants of one meaning, while
 * "fall_1" (noun: autumn) and "fall_2" (verb: to fall) are different meanings that just
 * share an English word — collapsing those would sign the wrong word.
 *
 * @returns {Array<{word, cls, rows, primary:boolean}>} rows sorted most-familiar first;
 *   `primary` marks the most familiar meaning of each English word.
 */
export function groupMeanings(rows = loadAslLexRows()) {
  const byWord = new Map();
  for (const row of rows) {
    const word = baseLemma(row.LemmaID);
    if (!word) continue;
    const cls = row.LexicalClass || 'Unknown';
    if (!byWord.has(word)) byWord.set(word, new Map());
    const classes = byWord.get(word);
    if (!classes.has(cls)) classes.set(cls, []);
    classes.get(cls).push(row);
  }
  const out = [];
  for (const [word, classes] of byWord) {
    const groups = [...classes.entries()].map(([cls, rs]) => ({ word, cls, rows: rs.sort(byFamiliarity) }));
    groups.sort((a, b) => byFamiliarity(a.rows[0], b.rows[0]));
    groups.forEach((g, i) => out.push({ ...g, primary: i === 0 }));
  }
  return out;
}

/** One ASL-LEX row -> this app's ordered steps. Pure; exported for the verification report. */
export function stepsFromRow(row) {
  const rightH = handshapeIdFor(row['Handshape.2.0']);
  if (!rightH) return null;
  const signType = row['SignType.2.0'];
  const twoHanded = signType && signType !== 'OneHanded';
  const sameShape = signType === 'SymmetricalOrAlternating' || signType === 'AsymmetricalSameHandshape';
  const leftH = !twoHanded ? null : (handshapeIdFor(row['NonDominantHandshape.2.0']) ?? (sameShape ? rightH : null));
  // Both hands move in symmetrical/alternating signs (and in the two "violation" types, where
  // ASL-LEX notes the non-dominant hand moves too); otherwise the other hand is a still base.
  const bothMove = signType === 'SymmetricalOrAlternating' || signType === 'DominanceViolation' || signType === 'SymmetryViolation';

  const mv = movementIdFor(row['Movement.2.0'], row['RepeatedMovement.2.0']);
  // A sign made in neutral signing space has no body location; one that travels into it
  // (SecondMinorLocation "Neutral") ends at LX_NEUTRAL.
  const minor = String(row['MinorLocation.2.0'] || '').trim();
  const loc1 = minor === 'Neutral' ? null : locationIdFor(minor);
  const loc2raw = coded(row['SecondMinorLocation.2.0']) ? locationIdFor(row['SecondMinorLocation.2.0']) : null;
  const loc2 = loc2raw && loc2raw !== loc1 ? loc2raw : null;
  const m2raw = coded(row['HandshapeM2.2.0']) ? handshapeIdFor(row['HandshapeM2.2.0']) : null;
  const m2 = m2raw && m2raw !== rightH ? m2raw : null;

  // When the sign travels to a second location, that travel IS its straight/curved path —
  // adding a separate stroke would invent a direction the data doesn't give.
  const travelIsPath = !!loc2 && /^MX_(STRAIGHT|CURVED)/.test(mv || '');
  const stepMove = travelIsPath ? null : mv;

  // Face and head are left unset (the avatar shows a neutral face): ASL-LEX codes manual
  // phonology only, so asserting a specific face would claim more than the source says.
  const first = {
    E: null, HD: null, L: loc1,
    H: { right: rightH, left: leftH },
    M: { right: stepMove, left: bothMove ? stepMove : null },
    together: [],
  };
  if (!loc2 && !m2) return [first];
  const second = {
    L: loc2 ?? null,
    H: { right: m2 ?? null, left: m2 && sameShape ? m2 : null },
    M: { right: null, left: null },
    together: [],
  };
  return [first, second];
}

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * @param claimed {Set<string>} English words already signed by a higher-priority source
 *   (the curated set). Those words' PRIMARY ASL-LEX meaning is not imported again.
 * @param claimedGlosses {Set<string>} glosses already used.
 */
export function buildAslLexData({ claimed = new Set(), claimedGlosses = new Set() } = {}) {
  const meanings = groupMeanings();
  const synonymsFor = new Map();
  for (const [syn, lemma] of Object.entries(SAME_SIGN_SYNONYMS)) {
    if (!synonymsFor.has(lemma)) synonymsFor.set(lemma, []);
    synonymsFor.get(lemma).push(syn);
  }

  const lemmaWords = new Set(meanings.map((m) => m.word.replace(/_/g, ' ')));
  const gestures = [];
  const usedGlosses = new Set(claimedGlosses);
  const rankOf = new Map(); // word -> how many meanings of it have been placed so far
  const skipped = [];
  for (const m of meanings) {
    const english = m.word.replace(/_/g, ' ');
    if (GRAMMAR_WORDS.has(english)) { skipped.push({ word: english, reason: 'grammar word (carried by grammar, not signed)' }); continue; }
    if (m.primary && claimed.has(english)) { skipped.push({ word: english, reason: 'covered by a curated sign' }); continue; }
    const row = m.rows[0];
    const signForm = stepsFromRow(row);
    if (!signForm) { skipped.push({ word: english, reason: 'no dominant handshape coded' }); continue; }

    const baseGloss = GLOSS_OVERRIDES[m.word] ?? english.toUpperCase();
    let gloss = m.primary ? baseGloss : `${baseGloss} (${CLASS_LABEL[m.cls] || m.cls.toLowerCase()})`;
    if (usedGlosses.has(gloss)) gloss = `${baseGloss} (${row.Code})`;
    usedGlosses.add(gloss);

    // The most familiar meaning of a word owns it (1); further meanings rank below (0.7, 0.6, …),
    // so a bare word picks the common sense and context or the user can pick the others.
    const rank = rankOf.get(english) ?? 0;
    rankOf.set(english, rank + 1);
    const keywords = [[english, rank === 0 ? 1 : Math.round((0.8 - 0.1 * rank) * 100) / 100]];
    const dom = String(row.DominantTranslation || '').trim().toLowerCase();
    const agree = Number(row.DominantTranslationAgreement);
    // Participants' dominant English translation, when most agreed on it — skipping values
    // that are just another entry id ("eat_1") and grammar words.
    if (dom && !/_\d*$|_/.test(dom) && dom !== english && Number.isFinite(agree) && agree >= 0.5 && !GRAMMAR_WORDS.has(dom)) {
      keywords.push([dom, Math.round((0.55 + 0.35 * agree) * 100) / 100]);
    }
    // ASL-LEX labels each recorded variant of a lemma with an English word of its own (lemma
    // NIGHT has an entry labelled "evening", BATHROOM one labelled "toilet") — those words are
    // signed with this lemma, so they are keywords of it, unless they have their own lemma.
    if (m.primary) {
      for (const r of m.rows) {
        const label = baseLemma(r.EntryID).replace(/_/g, ' ');
        if (label && label !== english && !lemmaWords.has(label) && !GRAMMAR_WORDS.has(label) && !keywords.some(([k]) => k === label)) {
          keywords.push([label, 0.95]);
        }
      }
    }
    // A same-sign synonym never overrides a word that has its own ASL-LEX sign.
    if (m.primary) for (const syn of synonymsFor.get(m.word) || []) if (!lemmaWords.has(syn) && !keywords.some(([k]) => k === syn)) keywords.push([syn, 0.95]);

    const variants = m.rows.slice(1).map((r) => r.EntryID);
    const pos = m.cls === 'Minor' ? (PRONOUNS.has(english) ? 'pronoun' : null) : (CLASS_POS[m.cls] ?? null);
    const notes = [];
    if (variants.length) notes.push(`${variants.length} other variant${variants.length > 1 ? 's' : ''} recorded`);
    if (row['FingerspelledLoanSign.2.0'] === '1') notes.push('a fingerspelled loan sign');
    if (row['Compound.2.0'] === '1') notes.push('a compound sign');

    gestures.push({
      gloss, pos, english, category: 'asl-lex',
      meaning: `${titleCase(english)}${m.cls && m.cls !== 'Unknown' ? ` (${CLASS_LABEL[m.cls] || m.cls.toLowerCase()})` : ''}. ASL-LEX 2.0 sign “${row.EntryID}”${notes.length ? `; ${notes.join('; ')}` : ''}.`,
      signForm,
      keywords,
      source: 'asl-lex',
      sourceRef: row.Code, // ASL-LEX's unique sign code (EntryID is not unique in the source file)
      frequency: freq(row),
      nondominantUncoded: row['SignType.2.0'] !== 'OneHanded' && !signForm[0].H.left,
    });
  }
  return { hands: aslLexHandRows, movements: aslLexMovementRows, locations: aslLexLocationRows, gestures, skipped };
}
