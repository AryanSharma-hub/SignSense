/**
 * Facial parameters (lib/rig/face.js: brow, tilt, eye, smile, open, width, cheek) ->
 * ARKit blend-shape weights 0..1 on the avatar's face. Both sides move together; the
 * avatar's meshes (skin, brows, lashes, teeth) each apply the names they carry.
 *
 * Calibrated shape by shape on this avatar (MPFB). Its ARKit shapes are strong, so every
 * weight is capped where the face still reads as natural:
 *   - brows carry the grammar (raised for yes/no questions, drawn down for wh-questions and
 *     concern) and stay clearly visible: browInnerUp/OuterUp up to ~0.8, browDown to ~0.6;
 *   - smiles are closed-lip (mouthSmile <= 0.5 with a little cheek), never a teeth-baring grin;
 *   - the jaw only parts slightly (jawOpen <= 0.12): wider shows a flat strip of teeth;
 *   - shapes that bare the teeth on this avatar (mouthUpperUp, mouthDimple, mouthFunnel,
 *     mouthShrugUpper, mouthLowerDown) and mouthClose (only valid with an open jaw) are never used.
 */
const c01 = (v) => Math.max(0, Math.min(1, v));

export function faceWeights(p, blink = 0) {
  const raise = c01(p.brow / 7), lower = c01(-p.brow / 3);
  const innerUp = c01(0.8 * raise + 0.55 * c01(-p.tilt));
  const down = Math.min(0.62, 0.5 * lower + 0.45 * c01(p.tilt));
  const smile = c01(p.smile), frown = c01(-p.smile);
  const squint = Math.min(0.28, c01((1 - p.eye) / 0.25) * 0.18 + smile * 0.1);
  const wide = c01((p.eye - 1) / 0.4) * 0.55;
  const narrow = c01((1 - p.width) / 0.3) * (1 - c01(p.open));
  const shut = c01(blink);
  const w = {
    browInnerUp: innerUp,
    browOuterUpLeft: 0.7 * raise, browOuterUpRight: 0.7 * raise,
    browDownLeft: down, browDownRight: down,
    eyeSquintLeft: squint, eyeSquintRight: squint,
    eyeWideLeft: wide * (1 - shut), eyeWideRight: wide * (1 - shut),
    eyeBlinkLeft: shut, eyeBlinkRight: shut,
    mouthSmileLeft: 0.5 * smile, mouthSmileRight: 0.5 * smile,
    cheekSquintLeft: 0.3 * c01(p.cheek) + 0.1 * smile, cheekSquintRight: 0.3 * c01(p.cheek) + 0.1 * smile,
    mouthFrownLeft: 0.42 * frown, mouthFrownRight: 0.42 * frown,
    mouthShrugLower: 0.3 * frown,
    mouthPressLeft: 0.42 * narrow, mouthPressRight: 0.42 * narrow,
    mouthPucker: 0.18 * narrow + 0.22 * c01(p.open),
    mouthStretchLeft: c01((p.width - 1) / 0.15) * 0.18, mouthStretchRight: c01((p.width - 1) / 0.15) * 0.18,
    jawOpen: 0.12 * c01(p.open),
  };
  return w;
}

export const FACE_SHAPES = Object.keys(faceWeights({ brow: 0, tilt: 0, eye: 1, smile: 0, open: 0, width: 1, cheek: 0 }));
