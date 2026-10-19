import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from '../lib/router.js';
import { api } from '../api/client.js';
import { Icon } from '../components/ui.jsx';
import { HandGlyph } from '../components/HandShape.jsx';
import { SignPlayer } from '../components/SignPlayer.jsx';
import { ProgressBar } from './LearnPage.jsx';
import { useTest } from '../hooks/useLearn.js';
import { useVocabulary } from '../api/hooks.js';

const LETTERS = ['A', 'B', 'C', 'D'];

/** One question. Options lock once answered; the server says whether it was right. */
function Question({ q, index, vocab, feedback, onAnswer, busy }) {
  const answered = feedback != null;
  const optionClass = (k) => {
    if (!answered) return 'border-line bg-surface hover:border-hand/60 hover:bg-surface2';
    if (k === feedback.answer) return 'border-ok bg-ok/15 ring-2 ring-ok';
    if (k === feedback.chosen) return 'border-live bg-live/10 ring-2 ring-live';
    return 'border-line bg-surface opacity-60';
  };
  const mark = (k) => (answered && k === feedback.answer ? '✓' : answered && k === feedback.chosen ? '✗' : LETTERS[k]);

  return (
    <section aria-labelledby={`q-${index}`} className="panel p-4 md:p-6">
      <h3 id={`q-${index}`} className="font-display text-[22px] font-semibold">{q.prompt}</h3>
      {q.meaning && q.type !== 'recognize' && <p className="text-[14.5px] text-muted">{q.meaning}</p>}

      {q.type === 'recognize' && (
        <div className="mt-3 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
          <SignPlayer signForm={q.signForm} vocab={vocab} label="the sign" loop className="mx-auto w-full max-w-[380px]" />
          <div className="grid gap-2" role="group" aria-label="Answers">
            {q.options.map((o, k) => (
              <button key={k} type="button" disabled={answered || busy} onClick={() => onAnswer(k)}
                className={`flex min-h-[54px] items-center gap-3 rounded-xl border px-3 text-left text-[17px] font-semibold transition-colors ${optionClass(k)}`}>
                <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface2 text-[14px]">{mark(k)}</span>
                <span className="gloss">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {q.type === 'produce' && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Answers">
          {q.options.map((o, k) => (
            <div key={k} className={`rounded-xl border p-2 transition-colors ${optionClass(k)}`}>
              <SignPlayer signForm={o.signForm} vocab={vocab} label={`option ${LETTERS[k]}`} compact loop={false} />
              <button type="button" disabled={answered || busy} onClick={() => onAnswer(k)} className="btn mt-2 w-full !min-h-[40px]">
                <span aria-hidden className="font-bold">{mark(k)}</span> {answered ? (k === feedback.answer ? 'This one' : '') : `Choose ${LETTERS[k]}`}
              </button>
            </div>
          ))}
        </div>
      )}

      {q.type === 'handshape' && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label="Answers">
          {q.options.map((o, k) => (
            <button key={k} type="button" disabled={answered || busy} onClick={() => onAnswer(k)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-[14.5px] font-semibold transition-colors ${optionClass(k)}`}>
              <HandGlyph shape={o.shape} size={56} />
              <span>{o.label}</span>
              <span aria-hidden className="text-[13px] text-muted">{mark(k)}</span>
            </button>
          ))}
        </div>
      )}

      {answered && (
        <div role="status" className={`mt-4 rounded-xl border px-4 py-3 ${feedback.correct ? 'border-ok/40 bg-ok/10' : 'border-live/40 bg-live/10'}`}>
          <p className="text-[16px] font-semibold">{feedback.correct ? 'Correct!' : 'Not quite.'} {feedback.gloss && <>That sign is <span className="gloss">{feedback.gloss}</span>.</>}</p>
          {!feedback.correct && feedback.signForm && (
            <div className="mt-3 max-w-[260px]"><SignPlayer signForm={feedback.signForm} vocab={vocab} label={feedback.gloss} compact /></div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * A lesson test or a spaced review. Questions come from the server without answers; each
 * answer is checked by the server as it's given, then the whole test is scored.
 */
export default function TestPage({ lessonId, review = false }) {
  const voc = useVocabulary();
  const { start, submit } = useTest();
  const [test, setTest] = useState(null);
  const [i, setI] = useState(0);
  const [feedback, setFeedback] = useState([]);
  const started = useRef(false);
  const answer = useMutation({ mutationFn: ({ index, choice }) => api.post(`/learn/tests/${test.id}/answer`, { index, choice }) });

  const begin = () => {
    setTest(null); setI(0); setFeedback([]); submit.reset();
    start.mutate(review ? { kind: 'review' } : { lessonId }, { onSuccess: setTest });
  };
  useEffect(() => { if (!started.current) { started.current = true; begin(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onAnswer = (choice) => {
    answer.mutate({ index: i, choice }, {
      onSuccess: (r) => setFeedback((f) => { const n = f.slice(); n[i] = { ...r, chosen: choice }; return n; }),
    });
  };
  const finish = () => submit.mutate({ id: test.id, answers: feedback.map((f) => f?.chosen ?? null) });

  if (start.error) {
    return (
      <div className="panel mx-auto max-w-lg p-6 text-center" role="alert">
        <p className="text-[16px]">{start.error.message}</p>
        <Link to="/learn" className="btn btn-primary mt-4">Back to lessons</Link>
      </div>
    );
  }
  if (!test || !voc.ready) return <p className="py-16 text-center text-muted" role="status">Preparing your test…</p>;

  if (submit.data) {
    const r = submit.data;
    const pct = Math.round((r.score / r.total) * 100);
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="panel p-6 text-center">
          <p className="field-label">{review ? 'Review complete' : 'Test complete'}</p>
          <p className="mt-1 font-display text-[56px] font-semibold leading-none">{pct}%</p>
          <p className="mt-1 text-[16px]">{r.score} of {r.total} correct</p>
          {!review && <p className={`mt-2 font-semibold ${r.passed ? 'text-ok' : 'text-muted'}`}>{r.passed ? 'Lesson complete — well done!' : `You need ${Math.round(r.passMark * 100)}% to complete this lesson. Try again whenever you like.`}</p>}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => { started.current = true; begin(); }}><Icon name="replay" size={15} /> {review ? 'Another review' : 'Retake'}</button>
            {!review && <Link to={`/learn/${lessonId}`} className="btn">Study the lesson again</Link>}
            <Link to="/learn" className="btn">All lessons</Link>
            <Link to="/progress" className="btn btn-quiet">See your progress</Link>
          </div>
        </section>
        <section className="panel p-4">
          <h3 className="mb-2 font-semibold">Your answers</h3>
          <ul className="divide-y divide-line">
            {r.results.map((x, k) => (
              <li key={k} className="flex items-center gap-3 py-2">
                <span aria-hidden className={`grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold ${x.correct ? 'bg-ok/15 text-ok' : 'bg-live/15 text-live'}`}>{x.correct ? '✓' : '✗'}</span>
                <span className="gloss">{x.gloss}</span>
                <span className="sr-only">{x.correct ? 'correct' : 'wrong'}</span>
                <span className="ml-auto text-[13px] text-muted">{test.questions[k].type === 'recognize' ? 'Recognise the sign' : test.questions[k].type === 'produce' ? 'Find the sign' : 'Handshape'}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  const q = test.questions[i];
  const answered = feedback[i] != null;
  const last = i === test.questions.length - 1;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[24px] font-semibold">{review ? 'Review' : 'Lesson test'}</h2>
        <span className="text-[14px] text-muted">Question {i + 1} of {test.questions.length}</span>
        <div className="min-w-[160px] flex-1"><ProgressBar value={(i + (answered ? 1 : 0)) / test.questions.length} label="Test progress" /></div>
      </header>
      <Question key={i} q={q} index={i} vocab={voc.vocab} feedback={feedback[i]} onAnswer={onAnswer} busy={answer.isPending} />
      {answer.error && <p role="alert" className="text-live">{answer.error.message}</p>}
      <div className="flex justify-end">
        {answered && (last
          ? <button type="button" className="btn btn-primary" onClick={finish} disabled={submit.isPending}>{submit.isPending ? 'Scoring…' : 'See my score'}</button>
          : <button type="button" className="btn btn-primary" onClick={() => setI(i + 1)} autoFocus>Next question <Icon name="right" size={15} /></button>)}
      </div>
      {submit.error && <p role="alert" className="text-live">{submit.error.message}</p>}
    </div>
  );
}
