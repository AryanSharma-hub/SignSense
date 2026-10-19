import { Router } from 'express';
import { requireUser } from '../auth/index.js';
import { getGesturesCached, getParameters } from '../db/queries.js';
import { getSettings } from '../settings.js';
import { buildTest, gradeTest, nextBox, dueAt, streakDays, LEARNED_BOX, MASTERED_BOX } from '../learn/engine.js';

const asInt = (v) => (Number.isInteger(Number(v)) ? Number(v) : null);

async function lessonSigns(db, lessonId) {
  const { rows } = await db.query('select gesture_id from lesson_signs where lesson_id=$1 order by position, gesture_id', [lessonId]);
  const all = await getGesturesCached(db);
  const byId = new Map(all.map((g) => [g.id, g]));
  return rows.map((r) => byId.get(r.gesture_id)).filter(Boolean);
}

export function learnRoutes(db) {
  const r = Router();
  r.use(requireUser);
  r.use(async (req, res, next) => {
    const s = await getSettings(db);
    if (!s.learningEnabled && req.user.role !== 'admin') return res.status(403).json({ error: 'The learning module is switched off.' });
    req.settings = s;
    next();
  });

  /** Units and lessons with this learner's progress. */
  r.get('/lessons', async (req, res) => {
    const uid = req.user.id;
    const { rows } = await db.query(
      `select l.id, l.slug, l.unit, l.title, l.description, l.level, l.position,
              count(ls.gesture_id)::int as total,
              count(sp.gesture_id) filter (where sp.box >= ${LEARNED_BOX})::int as learned,
              count(sp.gesture_id)::int as studied,
              lp.completed_at, lp.best_score
         from lessons l
         left join lesson_signs ls on ls.lesson_id = l.id
         left join sign_progress sp on sp.gesture_id = ls.gesture_id and sp.user_id = $1
         left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = $1
        where l.published
        group by l.id, lp.completed_at, lp.best_score
        order by l.position, l.id`, [uid]);
    const due = await db.query('select count(*)::int n from sign_progress where user_id=$1 and next_review_at <= now()', [uid]);
    res.json({
      lessons: rows.map((l) => ({ ...l, completed: !!l.completed_at, bestScore: l.best_score })),
      dueCount: due.rows[0].n,
    });
  });

  r.get('/lessons/:id', async (req, res) => {
    const id = asInt(req.params.id);
    const { rows } = await db.query('select * from lessons where id=$1 and (published or $2)', [id, req.user.role === 'admin']);
    if (!rows[0]) return res.status(404).json({ error: 'Lesson not found.' });
    const signs = await lessonSigns(db, id);
    const prog = await db.query('select gesture_id, box, correct, wrong from sign_progress where user_id=$1 and gesture_id = any($2)',
      [req.user.id, signs.map((g) => g.id)]);
    const pById = new Map(prog.rows.map((p) => [p.gesture_id, p]));
    const lp = await db.query('select completed_at, best_score from lesson_progress where user_id=$1 and lesson_id=$2', [req.user.id, id]);
    res.json({
      lesson: { ...rows[0], completed: !!lp.rows[0]?.completed_at, bestScore: lp.rows[0]?.best_score ?? null },
      signs: signs.map((g) => ({ ...g, progress: pById.get(g.id) ?? null })),
      passMark: req.settings.passMark,
    });
  });

  /** The learner studied a sign (watched it in a lesson). */
  r.post('/signs/:gestureId/studied', async (req, res) => {
    const gid = asInt(req.params.gestureId);
    const lessonId = asInt(req.body?.lessonId);
    const exists = await db.query('select 1 from gestures where id=$1', [gid]);
    if (!exists.rows.length) return res.status(404).json({ error: 'Sign not found.' });
    await db.query(
      `insert into sign_progress (user_id, gesture_id) values ($1,$2)
       on conflict (user_id, gesture_id) do update set last_seen_at = now()`, [req.user.id, gid]);
    if (lessonId) {
      await db.query('insert into lesson_progress (user_id, lesson_id) values ($1,$2) on conflict do nothing', [req.user.id, lessonId]);
    }
    res.json({ ok: true });
  });

  /** Start a test: { lessonId } for a lesson test, or { kind: 'review' } for due / weakest signs. */
  r.post('/tests', async (req, res) => {
    const uid = req.user.id;
    const lessonId = asInt(req.body?.lessonId);
    const all = await getGesturesCached(db);
    const byId = new Map(all.map((g) => [g.id, g]));
    let targets, lessonPool, kind;
    if (lessonId) {
      const l = await db.query('select id from lessons where id=$1 and (published or $2)', [lessonId, req.user.role === 'admin']);
      if (!l.rows.length) return res.status(404).json({ error: 'Lesson not found.' });
      lessonPool = await lessonSigns(db, lessonId);
      targets = lessonPool.slice(0, req.settings.testLength);
      kind = 'lesson';
    } else {
      // Review: signs that are due first, then the ones answered wrong most often.
      const { rows } = await db.query(
        `select gesture_id from sign_progress where user_id=$1
          order by (next_review_at <= now()) desc, box asc, (wrong - correct) desc, next_review_at asc
          limit $2`, [uid, req.settings.testLength]);
      targets = rows.map((x) => byId.get(x.gesture_id)).filter(Boolean);
      if (targets.length < 2) return res.status(400).json({ error: 'Study a lesson first — reviews use the signs you have learned.' });
      lessonPool = targets;
      kind = 'review';
    }
    const { hands } = await getParameters(db);
    const { questions } = buildTest(targets, { lessonPool, pool: all, hands });
    if (questions.length === 0) return res.status(400).json({ error: 'This lesson has too few signs for a test.' });
    const { rows } = await db.query(
      'insert into test_attempts (user_id, lesson_id, kind, questions, total) values ($1,$2,$3,$4,$5) returning id',
      [uid, lessonId, kind, JSON.stringify(questions), questions.length]);
    res.status(201).json({ id: rows[0].id, kind, lessonId, questions: questions.map((q) => q.public) });
  });

  /**
   * Answer one question and learn straight away whether it was right (the key stays on the
   * server). An answer is final: answering the same question again is rejected.
   */
  r.post('/tests/:id/answer', async (req, res) => {
    const id = asInt(req.params.id);
    const { rows } = await db.query('select * from test_attempts where id=$1 and user_id=$2', [id, req.user.id]);
    const t = rows[0];
    if (!t) return res.status(404).json({ error: 'Test not found.' });
    if (t.finished_at) return res.status(409).json({ error: 'This test was already submitted.' });
    const index = asInt(req.body?.index), choice = asInt(req.body?.choice);
    const q = t.questions[index];
    if (!q || choice == null || choice < 0 || choice >= q.public.options.length) return res.status(400).json({ error: 'Invalid answer.' });
    const answers = Array.isArray(t.answers) ? t.answers : new Array(t.total).fill(null);
    if (answers[index] != null) return res.status(409).json({ error: 'You already answered this question.' });
    answers[index] = choice;
    await db.query('update test_attempts set answers=$1 where id=$2', [JSON.stringify(answers), id]);
    const g = (await getGesturesCached(db)).find((x) => x.id === q.key.gestureId);
    res.json({ correct: choice === q.key.answer, answer: q.key.answer, gloss: g?.gloss ?? null, gestureId: q.key.gestureId, signForm: g?.signForm ?? null });
  });

  /** Submit answers (option index per question). Grades, updates spaced repetition and lesson progress. */
  r.post('/tests/:id/submit', async (req, res) => {
    const id = asInt(req.params.id);
    const { rows } = await db.query('select * from test_attempts where id=$1 and user_id=$2', [id, req.user.id]);
    const t = rows[0];
    if (!t) return res.status(404).json({ error: 'Test not found.' });
    if (t.finished_at) return res.status(409).json({ error: 'This test was already submitted.' });
    // Answers given one by one (/answer) are final; a full list in the body fills any left blank.
    const stored = Array.isArray(t.answers) ? t.answers : [];
    const sent = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const answers = Array.from({ length: t.total }, (_, i) => (Number.isInteger(stored[i]) ? stored[i] : Number.isInteger(sent[i]) ? sent[i] : null));
    const graded = gradeTest(t.questions, answers);
    await db.query('update test_attempts set answers=$1, score=$2, finished_at=now() where id=$3',
      [JSON.stringify(answers), graded.score, id]);

    for (const r0 of graded.results) {
      const { rows: cur } = await db.query('select box from sign_progress where user_id=$1 and gesture_id=$2', [req.user.id, r0.gestureId]);
      const box = nextBox(cur[0]?.box ?? 0, r0.correct);
      await db.query(
        `insert into sign_progress (user_id, gesture_id, box, correct, wrong, next_review_at)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (user_id, gesture_id) do update set box=$3, correct=sign_progress.correct+$4,
           wrong=sign_progress.wrong+$5, last_seen_at=now(), next_review_at=$6`,
        [req.user.id, r0.gestureId, box, r0.correct ? 1 : 0, r0.correct ? 0 : 1, dueAt(box)]);
    }
    const ratio = graded.total ? graded.score / graded.total : 0;
    const passed = ratio >= req.settings.passMark;
    if (t.lesson_id) {
      await db.query(
        `insert into lesson_progress (user_id, lesson_id, best_score, completed_at) values ($1,$2,$3,$4)
         on conflict (user_id, lesson_id) do update set best_score = greatest(coalesce(lesson_progress.best_score, 0), $3),
           completed_at = coalesce(lesson_progress.completed_at, $4)`,
        [req.user.id, t.lesson_id, ratio, passed ? new Date() : null]);
    }
    const all = await getGesturesCached(db);
    const byId = new Map(all.map((g) => [g.id, g]));
    res.json({
      score: graded.score, total: graded.total, passed, passMark: req.settings.passMark,
      results: graded.results.map((x) => ({ ...x, gloss: byId.get(x.gestureId)?.gloss ?? null })),
    });
  });

  /** The learner's report: totals, streak, units, test history, weakest signs. */
  r.get('/report', async (req, res) => {
    const uid = req.user.id;
    const totals = (await db.query(
      `select count(*)::int studied,
              count(*) filter (where box >= ${LEARNED_BOX})::int learned,
              count(*) filter (where box >= ${MASTERED_BOX})::int mastered,
              count(*) filter (where next_review_at <= now())::int due,
              coalesce(sum(correct),0)::int correct, coalesce(sum(wrong),0)::int wrong
         from sign_progress where user_id=$1`, [uid])).rows[0];
    const tests = (await db.query(
      `select t.id, t.kind, t.score, t.total, t.finished_at, l.title as lesson
         from test_attempts t left join lessons l on l.id = t.lesson_id
        where t.user_id=$1 and t.finished_at is not null order by t.finished_at desc limit 50`, [uid])).rows;
    const lessons = (await db.query(
      `select l.unit, count(distinct l.id)::int total, count(distinct lp.lesson_id) filter (where lp.completed_at is not null)::int completed
         from lessons l left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id=$1
        where l.published group by l.unit order by min(l.position)`, [uid])).rows;
    const weakest = (await db.query(
      `select sp.gesture_id, g.gloss, sp.correct, sp.wrong, sp.box from sign_progress sp join gestures g on g.id = sp.gesture_id
        where sp.user_id=$1 and sp.wrong > 0 order by (sp.wrong::real / (sp.correct + sp.wrong)) desc, sp.wrong desc limit 8`, [uid])).rows;
    const activity = (await db.query(
      `select last_seen_at as d from sign_progress where user_id=$1
       union all select finished_at from test_attempts where user_id=$1 and finished_at is not null`, [uid])).rows.map((x) => x.d);
    const answered = totals.correct + totals.wrong;
    res.json({
      totals: { ...totals, accuracy: answered ? totals.correct / answered : null, streak: streakDays(activity) },
      units: lessons, tests,
      weakest: weakest.map((w) => ({ gestureId: w.gesture_id, gloss: w.gloss, correct: w.correct, wrong: w.wrong, box: w.box })),
    });
  });

  return r;
}
