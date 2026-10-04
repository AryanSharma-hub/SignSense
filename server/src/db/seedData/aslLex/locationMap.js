/**
 * Translates ASL-LEX 2.0's 37 real MinorLocation categories into this app's location
 * vocab. Reuses existing location ids where there's a clean semantic match (Forehead,
 * Mouth, Chin, Shoulder, Waist, ...); adds new LX_-prefixed rows only for categories with
 * no existing match (Palm, FingerTip, wrist/forearm/elbow points, HeadTop, ...). Several
 * fine-grained hand-internal categories (FingerTip/FingerBack/FingerFront/FingerRadial/
 * FingerUlnar, PalmBack) share one approximate "the other hand" anchor region — this app's
 * location system models body anchors, not sub-hand contact points, so that granularity is
 * necessarily lost here; still a real, cited category, just approximated spatially.
 */
const NEW_LOCATIONS = [
  { code: 'UnderChin', id: 'LX_UNDERCHIN', label: 'Under the chin', anchorX: 120, anchorY: 122 },
  { code: 'Eye', id: 'LX_EYE', label: 'Eye', anchorX: 105, anchorY: 70 },
  { code: 'HeadTop', id: 'LX_HEADTOP', label: 'Top of the head', anchorX: 120, anchorY: 35 },
  { code: 'UpperLip', id: 'LX_UPPERLIP', label: 'Upper lip', anchorX: 120, anchorY: 90 },
  { code: 'Palm', id: 'LX_PALM', label: "The other hand's palm", anchorX: 120, anchorY: 180 },
  { code: 'PalmBack', id: 'LX_PALMBACK', label: "The other hand's back", anchorX: 130, anchorY: 180 },
  { code: 'HandAway', id: 'LX_HANDAWAY', label: 'Near the other hand', anchorX: 100, anchorY: 190 },
  { code: 'FingerTip', id: 'LX_FINGERTIP', label: "The other hand's fingertips", anchorX: 105, anchorY: 183 },
  { code: 'FingerBack', id: 'LX_FINGERBACK', label: "The other hand's finger backs", anchorX: 108, anchorY: 185 },
  { code: 'FingerFront', id: 'LX_FINGERFRONT', label: "The other hand's finger fronts", anchorX: 110, anchorY: 183 },
  { code: 'FingerRadial', id: 'LX_FINGERRADIAL', label: "The other hand's finger (thumb side)", anchorX: 112, anchorY: 186 },
  { code: 'FingerUlnar', id: 'LX_FINGERULNAR', label: "The other hand's finger (pinky side)", anchorX: 102, anchorY: 186 },
  { code: 'ForearmFront', id: 'LX_FOREARM_FRONT', label: 'Forearm (front)', anchorX: 90, anchorY: 210 },
  { code: 'ForearmBack', id: 'LX_FOREARM_BACK', label: 'Forearm (back)', anchorX: 88, anchorY: 212 },
  { code: 'ForearmUlnar', id: 'LX_FOREARM_ULNAR', label: 'Forearm (pinky side)', anchorX: 86, anchorY: 211 },
  { code: 'WristFront', id: 'LX_WRIST_FRONT', label: 'Wrist (front)', anchorX: 95, anchorY: 200 },
  { code: 'WristBack', id: 'LX_WRIST_BACK', label: 'Wrist (back)', anchorX: 93, anchorY: 201 },
  { code: 'ElbowBack', id: 'LX_ELBOW', label: 'Elbow', anchorX: 70, anchorY: 215 },
  { code: 'UpperArm', id: 'LX_UPPERARM', label: 'Upper arm', anchorX: 75, anchorY: 190 },
  { code: 'ArmAway', id: 'LX_ARMAWAY', label: 'Near the arm', anchorX: 70, anchorY: 195 },
  { code: 'BodyAway', id: 'LX_BODYAWAY', label: 'Near the torso', anchorX: 100, anchorY: 170 },
  { code: 'HeadAway', id: 'LX_HEADAWAY', label: 'Near the head', anchorX: 100, anchorY: 65 },
  { code: 'Heel', id: 'LX_HEEL', label: 'Heel of the hand', anchorX: 115, anchorY: 182 },
  { code: 'Other', id: 'LX_OTHER', label: 'Other location', anchorX: 120, anchorY: 160 },
];

/** Category -> an id that already exists in vocabParams.js (no new row needed). */
const REUSE = {
  Neutral: 'L01', Forehead: 'L02', Mouth: 'L03', Chin: 'L04', CheekNose: 'L05',
  Shoulder: 'L06', Waist: 'L07', Neck: 'L11', Hips: 'L14', Clavicle: 'L12',
  TorsoTop: 'L12', TorsoMid: 'L01', TorsoBottom: 'L13',
};

const BY_CODE = new Map(NEW_LOCATIONS.map((l) => [l.code, l.id]));

/** New location rows to append to the `locations` vocab table. */
export const aslLexLocationRows = NEW_LOCATIONS.map(({ code, id, label, anchorX, anchorY }) => ({
  id, label, bodyRegion: code.toLowerCase(), anchorX, anchorY, family: 'asl-lex',
}));

/** ASL-LEX MinorLocation category -> this app's location id (existing or new), or null. */
export function locationIdFor(code) {
  const c = String(code || '').trim();
  if (!c || c.toLowerCase() === 'na') return null;
  return REUSE[c] ?? BY_CODE.get(c) ?? null;
}
