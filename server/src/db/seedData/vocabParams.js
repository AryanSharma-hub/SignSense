/**
 * The five phonological parameter vocabularies. The original 13/12/6/7 rows (hands/
 * movements/heads/locations) are kept byte-for-byte so the original 16 gestures that
 * reference them never shift meaning. Growth beyond that (hands→~35, movements→~25,
 * locations→~15) is appended below, generated with varied-but-arbitrary geometry —
 * same draft/needs_review status as everything else; real labels and shapes still need
 * an ASL-fluent reviewer.
 */

export const expressions = [
  { id: 'E01', label: 'Neutral face',     glyph: '😐', family: 'neutral' },
  { id: 'E02', label: 'Soft smile',       glyph: '🙂', family: 'positive' },
  { id: 'E03', label: 'Open smile',       glyph: '😊', family: 'positive' },
  { id: 'E04', label: 'Frown',            glyph: '☹️', family: 'negative' },
  { id: 'E05', label: 'Warm gaze',        glyph: '🥰', family: 'positive' },
  { id: 'E06', label: 'Furrowed brow',    glyph: '😟', family: 'urgent' },
  { id: 'E07', label: 'Pursed lips',      glyph: '😣', family: 'urgent' },
  { id: 'E08', label: 'Pleading eyes',    glyph: '🥺', family: 'polite' },
  { id: 'E09', label: 'Raised brow',      glyph: '🤨', family: 'questioning' },
  { id: 'E10', label: 'Wide eyes',        glyph: '😲', family: 'surprised' },
  { id: 'E11', label: 'Downturned mouth', glyph: '😞', family: 'negative' },
  { id: 'E12', label: 'Big grin',         glyph: '😄', family: 'positive' },
];

// shape.curl = [thumb, index, middle, ring, pinky]; 0 = extended, 1 = fully curled.
export const hands = [
  { id: 'H01', label: 'Self-point',          glyph: '👆', family: 'point', shape: { curl: [0.8, 0, 1, 1, 1],          spread: 0 } },
  { id: 'H02', label: 'Open palm up',        glyph: '🤲', family: 'open',  bothHanded: true, shape: { curl: [0.25, 0.3, 0.3, 0.3, 0.35], spread: 0.3 } },
  { id: 'H03', label: 'Flat sweep',          glyph: '✋', family: 'flat',  shape: { curl: [0.25, 0, 0, 0, 0],         spread: 0 } },
  { id: 'H04', label: 'Claw forward',        glyph: '🤏', family: 'claw',  shape: { curl: [0.5, 0.55, 0.55, 0.55, 0.55], spread: 0.55 } },
  { id: 'H05', label: 'Open wave',           glyph: '👋', family: 'open',  shape: { curl: [0, 0, 0, 0, 0],            spread: 0.85 } },
  { id: 'H06', label: 'Palm shrug',          glyph: '🖐️', family: 'open',  shape: { curl: [0.05, 0, 0, 0, 0],         spread: 0.5 } },
  { id: 'H07', label: 'Flat at chin',        glyph: '✋', family: 'flat',  shape: { curl: [0.3, 0, 0, 0, 0],          spread: 0 } },
  { id: 'H08', label: 'Fingers to mouth',    glyph: '🤌', family: 'point', shape: { curl: [0.55, 0.6, 0.6, 0.6, 0.6], spread: 0 } },
  { id: 'H09', label: 'Crossed fists',       glyph: '✊', family: 'fist',  shape: { curl: [0.6, 1, 1, 1, 1],          spread: 0 } },
  { id: 'H10', label: 'Open palm request',   glyph: '🤲', family: 'open',  bothHanded: true, shape: { curl: [0.3, 0.3, 0.3, 0.3, 0.35], spread: 0.2 } },
  { id: 'H11', label: 'W-hand',              glyph: '🤟', family: 'letter', shape: { curl: [0.8, 0, 0, 0, 1],         spread: 0.65 } },
  { id: 'H12', label: 'Flat hands together', glyph: '🙏', family: 'flat',  bothHanded: true, shape: { curl: [0.3, 0, 0, 0, 0], spread: 0 } },
  { id: 'H13', label: 'Fist thumbs up',      glyph: '👍', family: 'fist',  shape: { curl: [0, 1, 1, 1, 1],            spread: 0, thumbAngle: -12 } },
];

// dir: compass position on the movement pad / drag target, or CENTER / PATTERN.
export const movements = [
  { id: 'M01', label: 'Forward tap',        dir: 'N',       family: 'forward' },
  { id: 'M02', label: 'Outward arc',        dir: 'NE',      family: 'forward' },
  { id: 'M07', label: 'Pull inward',        dir: 'E',       family: 'inward' },
  { id: 'M04', label: 'Chin-forward tap',   dir: 'SE',      family: 'forward' },
  { id: 'M05', label: 'Side-to-side shake', dir: 'S',       family: 'lateral' },
  { id: 'M06', label: 'Cross to chest',     dir: 'SW',      family: 'static' },
  { id: 'M03', label: 'Point to self',      dir: 'W',       family: 'static' },
  { id: 'M08', label: 'Palms-up lift',      dir: 'NW',      family: 'static' },
  { id: 'M12', label: 'Tap at mouth',       dir: 'CENTER',  family: 'repeat' },
  { id: 'M09', label: 'Circle at chin',     dir: 'PATTERN', family: 'circular' },
  { id: 'M10', label: 'Circle on chest',    dir: 'PATTERN', family: 'circular' },
  { id: 'M11', label: 'Small up-tap',       dir: 'PATTERN', family: 'repeat' },
];

export const heads = [
  { id: 'HD01', label: 'Forward / neutral',  glyph: '⬤',  family: 'neutral',  rotationDeg: 0,   dragDir: null, motion: null },
  { id: 'HD02', label: 'Nod down',           glyph: '⬇️', family: 'down',     rotationDeg: 14,  dragDir: 'S',  motion: 'nod' },
  { id: 'HD03', label: 'Tilt forward',       glyph: '↘️', family: 'forward',  rotationDeg: 8,   dragDir: 'SE', motion: null },
  { id: 'HD04', label: 'Shake side to side', glyph: '↔️', family: 'negative', rotationDeg: 0,   dragDir: null, motion: 'shake' },
  { id: 'HD05', label: 'Tilt left',          glyph: '↖️', family: 'side',     rotationDeg: -16, dragDir: 'W',  motion: null },
  { id: 'HD06', label: 'Tilt right',         glyph: '↗️', family: 'side',     rotationDeg: 16,  dragDir: 'E',  motion: null },
];

// Anchors are in the 240x300 signer viewBox. L01 is the neutral default.
export const locations = [
  { id: 'L01', label: 'Chest (neutral)', bodyRegion: 'chest',    anchorX: 120, anchorY: 160, family: 'torso' },
  { id: 'L02', label: 'Forehead',        bodyRegion: 'forehead', anchorX: 120, anchorY: 52,  family: 'head' },
  { id: 'L03', label: 'Mouth',           bodyRegion: 'mouth',    anchorX: 120, anchorY: 96,  family: 'head' },
  { id: 'L04', label: 'Chin',            bodyRegion: 'chin',     anchorX: 120, anchorY: 114, family: 'head' },
  { id: 'L05', label: 'Cheek',           bodyRegion: 'cheek',    anchorX: 150, anchorY: 90,  family: 'head' },
  { id: 'L06', label: 'Shoulder',        bodyRegion: 'shoulder', anchorX: 150, anchorY: 144, family: 'torso' },
  { id: 'L07', label: 'Waist',           bodyRegion: 'waist',    anchorX: 120, anchorY: 204, family: 'torso' },
];

// --- Growth (v5): more expressive variety for the larger gesture set below. Arbitrary,
// draft geometry — needs_review defaults true in the schema like every other row. ---

const HAND_LABELS = [
  'Curled fingers', 'Loose fist', 'Pinched fingers', 'Spread fingers', 'Bent hand', 'Hooked fingers',
  'Relaxed palm', 'Cupped hand', 'Crooked index', 'Stacked fingers', 'Splayed hand', 'Soft fist',
  'Tented fingers', 'Flicked fingers', 'Tight pinch', 'Angled palm', 'Loose wave', 'Half curl',
  'Tapered fingers', 'Index and thumb', 'Three-finger pinch', 'Flat blade',
];
for (let i = 0; i < HAND_LABELS.length; i++) {
  const n = i + 1;
  const base = (n * 0.37) % 1;
  hands.push({
    id: `H${14 + i}`, label: HAND_LABELS[i], family: 'extra',
    shape: {
      curl: [Math.round(((n * 0.21) % 1) * 100) / 100, Math.round(base * 100) / 100, Math.round(((base + 0.15) % 1) * 100) / 100,
        Math.round(((base + 0.3) % 1) * 100) / 100, Math.round(((base + 0.45) % 1) * 100) / 100],
      spread: Math.round(((n * 0.13) % 0.9) * 100) / 100,
    },
  });
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const MOVE_LABELS = [
  'Upward sweep', 'Diagonal push', 'Short jab', 'Downward drop', 'Wide shake', 'Inward draw',
  'Outward push', 'Lifted arc', 'Double tap', 'Slow circle', 'Quick flick', 'Rolling wave', 'Bounce',
];
for (let i = 0; i < MOVE_LABELS.length; i++) {
  movements.push({
    id: `M${13 + i}`, label: MOVE_LABELS[i],
    dir: i < COMPASS.length ? COMPASS[i] : 'PATTERN',
    family: 'extra',
  });
}

const LOC_EXTRA = [
  { label: 'Nose',         bodyRegion: 'nose',         anchorX: 120, anchorY: 80 },
  { label: 'Temple',       bodyRegion: 'temple',       anchorX: 100, anchorY: 60 },
  { label: 'Ear',          bodyRegion: 'ear',          anchorX: 165, anchorY: 75 },
  { label: 'Neck',         bodyRegion: 'neck',         anchorX: 120, anchorY: 135 },
  { label: 'Upper chest',  bodyRegion: 'chest',        anchorX: 120, anchorY: 140 },
  { label: 'Lower chest',  bodyRegion: 'chest',        anchorX: 120, anchorY: 175 },
  { label: 'Hip',          bodyRegion: 'hip',          anchorX: 120, anchorY: 220 },
  { label: 'Thigh',        bodyRegion: 'thigh',        anchorX: 120, anchorY: 250 },
];
LOC_EXTRA.forEach((l, i) => locations.push({ id: `L${8 + i}`, family: 'extra', ...l }));
