/**
 * Loads the real ASL-LEX 2.0 dataset (signdata.csv, downloaded from the project's OSF
 * repository — see ATTRIBUTION.md) and turns it into gesture entries using this app's
 * step shape, via the handshape/location/movement maps in this directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aslLexHandRows, handshapeIdFor } from './handshapeMap.js';
import { aslLexLocationRows, locationIdFor } from './locationMap.js';
import { aslLexMovementRows, movementIdFor } from './movementMap.js';
import { GRAMMAR_WORDS, EXCLUDE_GLOSSES } from '../generate.js';

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

function loadRows() {
  const text = fs.readFileSync(path.join(here, 'signdata.csv'), 'utf8');
  const parsed = parseCSV(text);
  const header = parsed[0];
  return parsed.slice(1)
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

/**
 * One row per BASE lemma. ASL-LEX gives phonological/regional variants of the same word
 * their own EntryID/LemmaID with a trailing "_<n>" ("sandwich", "sandwich_2", "sandwich_3",
 * "sandwich_4" are all the same English word) — the suffix is sometimes on EntryID only,
 * sometimes baked into LemmaID itself, so stripping it from LemmaID is what actually
 * de-dupes correctly. Prefers the unsuffixed variant when one exists.
 */
function dedupeByLemma(rows) {
  const baseOf = (s) => (s || '').trim().replace(/_\d+$/, '');
  const hasSuffix = (s) => /_\d+$/.test((s || '').trim());
  const byLemma = new Map();
  for (const row of rows) {
    const base = baseOf(row.LemmaID);
    if (!base) continue;
    const existing = byLemma.get(base);
    if (!existing || (hasSuffix(existing.LemmaID) && !hasSuffix(row.LemmaID))) byLemma.set(base, row);
  }
  return [...byLemma.values()];
}

function buildGesture(word, row) {
  const rightH = handshapeIdFor(row['Handshape.2.0']);
  if (!rightH) return null; // no dominant handshape recorded — nothing to render

  const signType = row['SignType.2.0'];
  let leftH = null;
  if (signType === 'SymmetricalOrAlternating' || signType === 'AsymmetricalSameHandshape') leftH = rightH;
  else if (signType === 'AsymmetricalDifferentHandshape') leftH = handshapeIdFor(row['NonDominantHandshape.2.0']);

  const mv = movementIdFor(row['Movement.2.0'], row['RepeatedMovement.2.0']);
  const loc = locationIdFor(row['MinorLocation.2.0']) ?? (row['MajorLocation.2.0'] === 'Neutral' ? 'L01' : null);
  const gloss = word.toUpperCase();

  return {
    gloss, pos: null, english: word, category: 'asl-lex',
    meaning: `${word.charAt(0).toUpperCase()}${word.slice(1)}.`,
    signForm: [{
      E: 'E01', HD: 'HD01', L: loc,
      H: { right: rightH, left: leftH },
      M: { right: mv, left: signType === 'SymmetricalOrAlternating' ? mv : null },
      together: [],
    }],
    keywords: [[word, 1]],
  };
}

/**
 * @param higherPriorityGestures every gesture already placed by the curated 16 (never
 *   overwritten) — both glosses and keywords are off-limits to a new ASL-LEX entry, same
 *   protection generate.js gives the placeholder layer against the curated set.
 */
export function buildAslLexData(higherPriorityGestures) {
  const rows = dedupeByLemma(loadRows());
  const gestures = [];
  const usedGlosses = new Set([...higherPriorityGestures.map((g) => g.gloss), ...EXCLUDE_GLOSSES]);
  const usedKeywords = new Set(higherPriorityGestures.flatMap((g) => g.keywords.map(([k]) => k.toLowerCase())));
  for (const row of rows) {
    const word = row.LemmaID.trim().replace(/_\d+$/, '').toLowerCase();
    if (!word || GRAMMAR_WORDS.has(word) || usedGlosses.has(word.toUpperCase()) || usedKeywords.has(word)) continue;
    const g = buildGesture(word, row);
    if (!g) continue;
    usedGlosses.add(g.gloss);
    usedKeywords.add(word);
    gestures.push(g);
  }
  return { hands: aslLexHandRows, movements: aslLexMovementRows, locations: aslLexLocationRows, gestures };
}
