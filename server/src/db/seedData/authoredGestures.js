/**
 * A small set of very common everyday signs that ASL-LEX 2.0 does not contain, written for
 * this project from standard ASL dictionary descriptions. They are coded in ASL-LEX's OWN
 * categories (handshape code, sign type, movement shape, locations, handshape change) and
 * converted by the same stepsFromRow() mapping, so they render exactly like ASL-LEX signs.
 *
 * Kept deliberately short: only signs whose citation form is well established and
 * unambiguous were added. Each is marked source "authored" in the database and the UI —
 * NOT source-verified the way ASL-LEX entries are — and needs review by a fluent signer.
 * Anything else not in ASL-LEX is left unsigned (fingerspelled when it is a name or number),
 * never given an invented sign.
 */
import { stepsFromRow } from './aslLex/index.js';

const row = (o) => ({
  'SignType.2.0': 'OneHanded', 'NonDominantHandshape.2.0': 'NA', 'RepeatedMovement.2.0': '0',
  'MajorLocation.2.0': 'Neutral', 'MinorLocation.2.0': 'Neutral', 'SecondMinorLocation.2.0': 'NA', 'HandshapeM2.2.0': 'NA',
  ...o,
});

const AUTHORED = [
  { gloss: 'FIVE', pos: 'adj', english: 'five', meaning: 'The number 5: an open 5-hand held up.',
    lex: row({ 'Handshape.2.0': '5', 'Movement.2.0': 'None' }) },
  { gloss: 'TEN', pos: 'adj', english: 'ten', meaning: 'The number 10: a thumbs-up A-hand shakes at the wrist.',
    lex: row({ 'Handshape.2.0': 'a', 'Movement.2.0': 'BackAndForth', 'RepeatedMovement.2.0': '1' }) },
  { gloss: 'FORGET', pos: 'verb', english: 'forget', meaning: 'Forgetting: a flat hand wipes across the forehead, closing into a fist.',
    lex: row({ 'Handshape.2.0': 'open_b', 'Movement.2.0': 'Straight', 'MajorLocation.2.0': 'Head', 'MinorLocation.2.0': 'Forehead', 'HandshapeM2.2.0': 'a' }) },
  { gloss: 'PROUD', pos: 'adj', english: 'proud', meaning: 'Pride: the thumb of an A-hand slides up the centre of the chest.',
    lex: row({ 'Handshape.2.0': 'a', 'Movement.2.0': 'Straight', 'MajorLocation.2.0': 'Body', 'MinorLocation.2.0': 'TorsoBottom', 'SecondMinorLocation.2.0': 'TorsoTop' }) },
  { gloss: 'NERVOUS', pos: 'adj', english: 'nervous', meaning: 'Nervousness: both open hands tremble in front of the body.',
    keywords: [['anxious', 0.8]],
    lex: row({ 'Handshape.2.0': '5', 'SignType.2.0': 'SymmetricalOrAlternating', 'NonDominantHandshape.2.0': '5', 'Movement.2.0': 'BackAndForth', 'RepeatedMovement.2.0': '1' }) },
  { gloss: 'EMERGENCY', pos: 'noun', english: 'emergency', meaning: 'An emergency: an E-hand shakes side to side.',
    lex: row({ 'Handshape.2.0': 'e', 'Movement.2.0': 'BackAndForth', 'RepeatedMovement.2.0': '1' }) },
  { gloss: 'POLICE', pos: 'noun', english: 'police', meaning: 'Police: a C-hand taps the chest where a badge would be.',
    keywords: [['cop', 0.9]],
    lex: row({ 'Handshape.2.0': 'c', 'Movement.2.0': 'Straight', 'RepeatedMovement.2.0': '1', 'MajorLocation.2.0': 'Body', 'MinorLocation.2.0': 'TorsoTop' }) },
  { gloss: 'STORE', pos: 'noun', english: 'store', meaning: 'A store: both flat-O hands swing forward from the wrists, twice.',
    lex: row({ 'Handshape.2.0': 'flat_o', 'SignType.2.0': 'SymmetricalOrAlternating', 'NonDominantHandshape.2.0': 'flat_o', 'Movement.2.0': 'Curved', 'RepeatedMovement.2.0': '1' }) },
  { gloss: 'TERRIBLE', pos: 'adj', english: 'terrible', meaning: 'Something awful: both hands flick open beside the head.',
    keywords: [['awful', 0.95], ['horrible', 0.8]],
    lex: row({ 'Handshape.2.0': '8', 'SignType.2.0': 'SymmetricalOrAlternating', 'NonDominantHandshape.2.0': '8', 'Movement.2.0': 'Straight', 'MajorLocation.2.0': 'Head', 'MinorLocation.2.0': 'HeadAway', 'HandshapeM2.2.0': '5' }) },
  { gloss: 'ICE CREAM', pos: 'noun', english: 'ice cream', meaning: 'Ice cream: a fist "licks" a cone in front of the mouth.',
    lex: row({ 'Handshape.2.0': 's', 'Movement.2.0': 'Straight', 'RepeatedMovement.2.0': '1', 'MajorLocation.2.0': 'Head', 'MinorLocation.2.0': 'Mouth' }) },
  { gloss: 'EXPLAIN', pos: 'verb', english: 'explain', meaning: 'Explaining: two F-hands move alternately forward and back.',
    keywords: [['describe', 0.9]],
    lex: row({ 'Handshape.2.0': 'f', 'SignType.2.0': 'SymmetricalOrAlternating', 'NonDominantHandshape.2.0': 'f', 'Movement.2.0': 'BackAndForth', 'RepeatedMovement.2.0': '1' }) },
];

export const authoredGestures = AUTHORED.map((a) => ({
  gloss: a.gloss, pos: a.pos, english: a.english,
  meaning: `${a.meaning} Authored for SignSense from standard ASL descriptions (not in ASL-LEX); needs review by a fluent signer.`,
  signForm: stepsFromRow(a.lex),
  keywords: [[a.english, 1], ...(a.keywords || [])],
  source: 'authored', sourceRef: null, frequency: null,
}));
