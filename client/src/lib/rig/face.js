/**
 * Facial expression as numbers, so the face can ease from one expression to the next
 * (brows, lids and mouth each move on their own) instead of cross-fading drawings.
 *
 *   brow   raise of both brows, viewBox units (negative = lowered)
 *   tilt   inner-brow slope: +1 inner ends down (furrowed), -1 inner ends up (pleading)
 *   eye    lid opening, 1 = relaxed
 *   smile  mouth-corner lift, -1..1
 *   open   jaw opening, 0..1
 *   width  mouth width multiplier
 *   cheek  cheek raise / blush, 0..1
 *
 * Keyed by expression `family` from the vocabulary — the same key the old drawings used,
 * so every existing expression row maps onto a face without data changes.
 */
export const FACE_PARAMS = {
  neutral:     { brow: 0,  tilt: 0,    eye: 1,    smile: 0,    open: 0,    width: 1,    cheek: 0 },
  positive:    { brow: 1,  tilt: 0,    eye: 0.82, smile: 1,    open: 0.25, width: 1.15, cheek: 0.8 },
  negative:    { brow: -1, tilt: -0.5, eye: 0.85, smile: -0.9, open: 0,    width: 0.9,  cheek: 0 },
  urgent:      { brow: -3, tilt: 1,    eye: 1.05, smile: -0.3, open: 0.12, width: 0.7,  cheek: 0 },
  polite:      { brow: 2,  tilt: -1,   eye: 1.15, smile: 0.25, open: 0,    width: 0.8,  cheek: 0.4 },
  questioning: { brow: 5,  tilt: 0,    eye: 1.18, smile: 0,    open: 0,    width: 0.9,  cheek: 0 },
  surprised:   { brow: 7,  tilt: 0,    eye: 1.4,  smile: 0,    open: 1,    width: 0.72, cheek: 0 },
};
export const FACE_KEYS = Object.keys(FACE_PARAMS.neutral);
export const faceParams = (family) => FACE_PARAMS[family] || FACE_PARAMS.neutral;
