import { byId } from './vocabulary.js';

/**
 * Non-manual markers: facial expression + head movement that carry grammar.
 * Direction A reads them off what the signer did; Direction B derives them from the
 * hearing user's sentence type (question -> raised/furrowed brows, negation -> headshake).
 *
 * needs_review: which expression/head ids ASL-fluent reviewers want for each marker
 * lives HERE (one table), so it is trivial to correct.
 */
export const MARKER_IDS = {
  question: { E: 'E09', HD: null },       // yes/no question: raised brows
  'wh-question': { E: 'E06', HD: null },  // wh-question: furrowed brows
  negation: { E: 'E04', HD: 'HD04' },     // frown + headshake
  statement: { E: null, HD: null },
  imperative: { E: null, HD: null },
};

/**
 * Build a marker from a sentence type. Combines (a negative question keeps the
 * question brows AND the headshake).
 * @param {{type?: string, wh?: boolean, negated?: boolean}} info
 */
export function markerFor(info = {}, vocab) {
  const type = info.type || 'statement';
  const negated = !!info.negated || type === 'negation';
  const isQ = type === 'question' || type === 'wh-question';
  const qKey = info.wh || type === 'wh-question' ? 'wh-question' : 'question';
  let E = isQ ? MARKER_IDS[qKey].E : negated ? MARKER_IDS.negation.E : null;
  let HD = negated ? MARKER_IDS.negation.HD : null;
  if (vocab) { if (E && !byId(vocab, 'E', E)) E = null; if (HD && !byId(vocab, 'HD', HD)) HD = null; }
  return { type: isQ ? 'question' : negated ? 'negation' : type, wh: !!(isQ && (info.wh || type === 'wh-question')), negated, E, HD };
}

/** Layer a marker over every step of a signForm (grammar spans the clause). */
export function applyMarker(signForm, marker) {
  if (!marker || (!marker.E && !marker.HD)) return signForm;
  return signForm.map((step) => ({
    ...step,
    E: marker.E ?? step.E ?? null,
    HD: marker.HD ?? step.HD ?? null,
  }));
}

export function describeMarker(marker, vocab) {
  if (!marker || (!marker.E && !marker.HD)) return '';
  const parts = [];
  const e = byId(vocab, 'E', marker.E); if (e) parts.push(e.label.toLowerCase());
  const h = byId(vocab, 'HD', marker.HD); if (h) parts.push(h.label.toLowerCase());
  return parts.join(' + ');
}
