/**
 * DRAFT SEED DATA — every row is inserted with needs_review = true.
 *
 * The parameter values below come from the v1 prototype and are a scaffold for
 * the interaction model. They are NOT verified ASL. Have an ASL-fluent reviewer
 * check them against a real reference (Lifeprint/ASL University, Handspeak, …)
 * before this app is used for anything beyond prototyping.
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

/**
 * Gestures. `signForm` uses the v4 step shape: {E, HD, L, H:{right,left}, M:{right,left}}.
 * `pos`/`english` feed the deterministic sentence assembler. `keywords` feed speech->sign
 * matching as [keyword, weight]. Multi-word keywords are matched as phrases.
 */
export const gestures = [
  { gloss: 'HELLO', pos: 'interj', english: 'hello', meaning: 'A friendly greeting exchanged on meeting someone.',
    signForm: [{ E: 'E01', L: 'L02', H: { right: 'H05' } }, { M: { right: 'M02' } }, { HD: 'HD01' }],
    keywords: [['hello', 1], ['hi', 1], ['hey', 0.9], ['greetings', 0.7], ['howdy', 0.6], ['good morning', 0.6], ['good afternoon', 0.6], ['good evening', 0.6]] },

  { gloss: 'THANK YOU', pos: 'interj', english: 'thank you', meaning: 'An expression of gratitude.',
    signForm: [{ E: 'E02', L: 'L04', H: { right: 'H07' } }, { M: { right: 'M04' } }, { HD: 'HD03' }],
    keywords: [['thank you', 1], ['thanks', 1], ['thank', 1], ['appreciate', 0.8], ['grateful', 0.7], ['cheers', 0.5]] },

  { gloss: 'YES', pos: 'interj', english: 'yes', meaning: 'An affirmative response.',
    signForm: [{ E: 'E03', H: { right: 'H02' } }, { M: { right: 'M01' } }, { HD: 'HD02' }],
    keywords: [['yes', 1], ['yeah', 0.9], ['yep', 0.9], ['yup', 0.9], ['sure', 0.6], ['ok', 0.6], ['okay', 0.6], ['correct', 0.6], ['agree', 0.7], ['of course', 0.6]] },

  { gloss: 'NO', pos: 'interj', english: 'no', meaning: 'A negative response.',
    signForm: [{ E: 'E04', H: { right: 'H03' } }, { M: { right: 'M05' } }, { HD: 'HD04' }],
    keywords: [['no', 1], ['nope', 0.9], ['nah', 0.9], ['no way', 0.7]] },

  { gloss: 'LOVE', pos: 'verb', english: 'love', meaning: 'An expression of deep affection — arms cross to hug the chest.',
    signForm: [{ E: 'E05', L: 'L01', H: { right: 'H09', left: 'H09' } }, { M: { right: 'M06', left: 'M06' } }, { HD: 'HD02' }],
    keywords: [['love', 1], ['adore', 0.8], ['in love', 0.8], ['cherish', 0.6]] },

  { gloss: 'HELP', pos: 'verb', english: 'help', meaning: 'A request for assistance — a fist rests on a flat palm and both lift together.',
    signForm: [{ E: 'E06', L: 'L01', H: { right: 'H13', left: 'H03' } }, { M: { right: 'M08', left: 'M08' } }, { HD: 'HD01' }],
    keywords: [['help', 1], ['assist', 0.9], ['aid', 0.6], ['support', 0.5], ['rescue', 0.6]] },

  { gloss: 'WATER', pos: 'noun', english: 'water', meaning: 'The clear liquid; also, to drink.',
    signForm: [{ E: 'E07', L: 'L04', H: { right: 'H11' } }, { M: { right: 'M09' } }, { HD: 'HD02' }],
    keywords: [['water', 1], ['drink', 0.8], ['thirsty', 0.8], ['thirst', 0.8], ['beverage', 0.5], ['hydrate', 0.5]] },

  { gloss: 'PLEASE', pos: 'interj', english: 'please', meaning: 'A polite request or appeal — both flat palms circle together on the chest.',
    signForm: [{ E: 'E08', L: 'L01', H: { right: 'H12', left: 'H12' } }, { M: { right: 'M10', left: 'M10' } }, { HD: 'HD03' }],
    keywords: [['please', 1], ['kindly', 0.7]] },

  { gloss: 'I', pos: 'pronoun', english: 'I', meaning: 'First-person self-reference.',
    signForm: [{ E: 'E01', L: 'L01', H: { right: 'H01' } }, { M: { right: 'M03' } }, { HD: 'HD01' }],
    keywords: [['i', 1], ['me', 0.9], ['myself', 0.8]] },

  { gloss: 'YOU', pos: 'pronoun', english: 'you', meaning: 'Second-person reference — point toward the person addressed.',
    signForm: [{ E: 'E01', H: { right: 'H01' } }, { M: { right: 'M01' } }],
    keywords: [['you', 1], ['yourself', 0.7]] },

  { gloss: 'WANT', pos: 'verb', english: 'want', meaning: 'A desire for something.',
    signForm: [{ E: 'E06', H: { right: 'H04' } }, { M: { right: 'M07' } }, { HD: 'HD01' }],
    keywords: [['want', 1], ['need', 0.8], ['desire', 0.7], ['wish', 0.6], ['crave', 0.5], ['wanna', 0.9],
               ['would like', 0.9], ['give me', 0.7], ['can i have', 0.7], ['could i have', 0.7], ['may i have', 0.7]] },

  { gloss: 'GOOD', pos: 'adj', english: 'good', meaning: 'A positive quality or approval.',
    signForm: [{ E: 'E02', L: 'L04', H: { right: 'H05' } }, { M: { right: 'M02' } }, { HD: 'HD02' }],
    keywords: [['good', 1], ['great', 0.8], ['nice', 0.8], ['excellent', 0.8], ['awesome', 0.7], ['wonderful', 0.7], ['fine', 0.6], ['okay', 0.5], ['ok', 0.5]] },

  { gloss: 'MORE', pos: 'adv', english: 'more', meaning: 'A request for an additional amount.',
    signForm: [{ E: 'E09', L: 'L01', H: { right: 'H06' } }, { M: { right: 'M11' } }, { HD: 'HD01' }],
    keywords: [['more', 1], ['another', 0.7], ['again', 0.6], ['extra', 0.6], ['additional', 0.6]] },

  { gloss: 'EAT', pos: 'verb', english: 'eat', meaning: 'The act of eating, or hunger.',
    signForm: [{ E: 'E07', L: 'L03', H: { right: 'H08' } }, { M: { right: 'M12' } }, { HD: 'HD02' }],
    keywords: [['eat', 1], ['food', 0.8], ['hungry', 0.9], ['hunger', 0.8], ['meal', 0.7], ['lunch', 0.6], ['dinner', 0.6], ['breakfast', 0.6], ['snack', 0.6], ['starving', 0.6], ['feed', 0.5]] },

  // MOTHER / FATHER differ ONLY by location (chin vs forehead) — the reason the location parameter exists.
  { gloss: 'MOTHER', pos: 'noun', english: 'mother', meaning: 'A female parent. Made at the chin.',
    signForm: [{ E: 'E01', L: 'L04', H: { right: 'H06' } }, { M: { right: 'M11' } }],
    keywords: [['mother', 1], ['mom', 1], ['mum', 1], ['mama', 0.9], ['mommy', 0.9], ['mummy', 0.9]] },

  { gloss: 'FATHER', pos: 'noun', english: 'father', meaning: 'A male parent. Made at the forehead.',
    signForm: [{ E: 'E01', L: 'L02', H: { right: 'H06' } }, { M: { right: 'M11' } }],
    keywords: [['father', 1], ['dad', 1], ['papa', 0.9], ['daddy', 0.9]] },
];
