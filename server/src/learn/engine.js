/**
 * The learning engine: spaced repetition, test generation and grading. Pure functions —
 * no database — so they are unit-tested directly.
 *
 * Spaced repetition is a Leitner system: a sign starts in box 0 when first studied; each
 * correct test answer moves it up one box (max 5), a wrong one sends it back to box 1. The
 * box sets when it is next due for review.
 *
 * Tests are generated and graded on the SERVER: the client receives questions without the
 * answer key (a "which sign is this?" question carries only the movement data, not the
 * gloss or id), so a score reflects what the learner actually recognised.
 */
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
export const LEARNED_BOX = 2;   // answered correctly on two separate occasions
export const MASTERED_BOX = 4;

export function nextBox(box, correct) {
  return correct ? Math.min(5, (box ?? 0) + 1) : 1;
}
export function dueAt(box, now = new Date()) {
  return new Date(now.getTime() + BOX_INTERVAL_DAYS[Math.max(0, Math.min(5, box))] * 864e5);
}

/** Only what ASL-LEX codes: what the learner can actually see differ between two signs. */
const manualKey = (g) => JSON.stringify((g.signForm || []).map((s) => [s.H?.right ?? null, s.H?.left ?? null, s.L ?? null, s.M?.right ?? null, s.M?.left ?? null]));
const baseWord = (g) => String(g.english || g.gloss).toLowerCase();

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Pick `n` wrong options for `target`: first from the lesson (signs the learner is
 * studying together), then signs that share a handshape or location with it (plausible,
 * so the test checks real recognition), then anything. Never the same word, and never a
 * sign that looks identical (a variant would make the question unanswerable).
 */
export function pickDistractors(target, { lessonPool = [], pool = [], n = 3, rng = Math.random }) {
  const key = manualKey(target), word = baseWord(target);
  const ok = (g) => g.id !== target.id && baseWord(g) !== word && manualKey(g) !== key && g.signForm?.length;
  const t0 = target.signForm[0] || {};
  const similar = (g) => g.signForm[0]?.H?.right === t0.H?.right || (t0.L && g.signForm[0]?.L === t0.L);
  const out = [];
  const seen = new Set();
  const take = (list) => {
    for (const g of shuffle(list, rng)) {
      if (out.length >= n) return;
      if (!ok(g) || seen.has(g.id) || seen.has(baseWord(g)) || out.some((o) => manualKey(o) === manualKey(g))) continue;
      seen.add(g.id); seen.add(baseWord(g));
      out.push(g);
    }
  };
  take(lessonPool);
  if (out.length < n) take(pool.filter(similar).slice(0, 400));
  if (out.length < n) take(pool.slice(0, 3000));
  return out;
}

const QUESTION_TYPES = ['recognize', 'produce', 'handshape'];

/**
 * Build a test. Returns { questions } where each question has a public part (sent to the
 * client) and a `key` (kept on the server): { public, key: { answer, gestureId } }.
 *
 * @param targets  the signs being tested (one question each, in a shuffled order)
 * @param hands    the handshape vocabulary rows (for handshape questions)
 */
export function buildTest(targets, { lessonPool = [], pool = [], hands = [], rng = Math.random } = {}) {
  const handById = new Map(hands.map((h) => [h.id, h]));
  const realHands = hands.filter((h) => String(h.id).startsWith('HX_'));
  const questions = [];
  shuffle(targets, rng).forEach((target, i) => {
    let type = QUESTION_TYPES[(i + Math.floor(rng() * 3)) % 3];
    const handId = target.signForm[0]?.H?.right;
    if (type === 'handshape' && !(handById.get(handId) && realHands.length >= 4)) type = 'recognize';
    const wrong = pickDistractors(target, { lessonPool, pool, n: 3, rng });
    if (type !== 'handshape' && wrong.length < 2) return; // not enough distinct signs to ask fairly

    if (type === 'handshape') {
      const others = shuffle(realHands.filter((h) => h.id !== handId), rng).slice(0, 3);
      const options = shuffle([handById.get(handId), ...others], rng);
      questions.push({
        public: { type, prompt: `Which handshape does ${target.gloss} start with?`, gloss: target.gloss, meaning: target.meaning,
          options: options.map((h) => ({ handId: h.id, label: h.label, shape: h.shape })) },
        key: { answer: options.findIndex((h) => h.id === handId), gestureId: target.id },
      });
      return;
    }
    const options = shuffle([target, ...wrong], rng);
    const answer = options.findIndex((g) => g.id === target.id);
    if (type === 'recognize') {
      questions.push({
        public: { type, prompt: 'Which sign is this?', signForm: target.signForm, options: options.map((g) => ({ label: g.gloss })) },
        key: { answer, gestureId: target.id },
      });
    } else {
      questions.push({
        public: { type, prompt: `Which of these is ${target.gloss}?`, gloss: target.gloss, meaning: target.meaning,
          options: options.map((g) => ({ signForm: g.signForm })) },
        key: { answer, gestureId: target.id },
      });
    }
  });
  return { questions };
}

/**
 * Grade answers against the stored questions.
 * @returns {{score, total, results: Array<{correct, answer, chosen, gestureId}>}}
 */
export function gradeTest(questions, answers) {
  const results = questions.map((q, i) => {
    const chosen = Number.isInteger(answers?.[i]) ? answers[i] : null;
    return { correct: chosen === q.key.answer, answer: q.key.answer, chosen, gestureId: q.key.gestureId };
  });
  return { score: results.filter((r) => r.correct).length, total: questions.length, results };
}

/** Consecutive days (ending today or yesterday) with any learning activity. */
export function streakDays(activityDates, now = new Date()) {
  const days = new Set(activityDates.map((d) => new Date(d).toISOString().slice(0, 10)));
  const day = (offset) => new Date(now.getTime() - offset * 864e5).toISOString().slice(0, 10);
  let start = days.has(day(0)) ? 0 : days.has(day(1)) ? 1 : -1;
  if (start < 0) return 0;
  let n = 0;
  while (days.has(day(start + n))) n++;
  return n;
}
