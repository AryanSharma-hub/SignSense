/**
 * The original 16 hand-authored gestures (v1-v4). Kept byte-for-byte: several tests
 * hardcode exact behavior against these (MOTHER/FATHER location-only difference,
 * HELP joined=false / PLEASE joined=true, the "water or a sandwich" reply, etc.) —
 * see server/test/api.test.js and the client integration test. Dataset growth from
 * here on is strictly additive (see bulkGestures.js).
 */
export const curatedGestures = [
  { gloss: 'HELLO', pos: 'interj', english: 'hello', meaning: 'A friendly greeting exchanged on meeting someone.',
    // together: the handshape and its location at the forehead are deliberately linked —
    // a demonstration of the explicit pairing feature (independent of the forward tap that follows).
    signForm: [{ E: 'E01', L: 'L02', H: { right: 'H05' }, together: [['H', 'L']] }, { M: { right: 'M02' } }, { HD: 'HD01' }],
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
