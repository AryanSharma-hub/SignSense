import { useEffect, useState } from 'react';
import { Link, useRouter } from '../lib/router.js';
import { Icon, ParamChip, SourceBadge } from '../components/ui.jsx';
import { SignPlayer } from '../components/SignPlayer.jsx';
import { ReportSignButton } from '../components/ReportSign.jsx';
import { useLesson, useStudied } from '../hooks/useLearn.js';
import { useVocabulary } from '../api/hooks.js';
import { describeSign } from '../lib/describeSign.js';

/** Study a lesson sign by sign, then take its test. */
export default function LessonPage({ lessonId }) {
  const { navigate } = useRouter();
  const q = useLesson(lessonId);
  const voc = useVocabulary();
  const studied = useStudied();
  const [i, setI] = useState(0);
  const signs = q.data?.signs || [];
  const sign = signs[i];

  // Record each sign as studied when the learner reaches it.
  useEffect(() => {
    if (sign) studied.mutate({ gestureId: sign.id, lessonId });
  }, [sign?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight') setI((x) => Math.min(signs.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signs.length]);

  if (q.isLoading || !voc.ready) return <p className="py-16 text-center text-muted" role="status">Loading lesson…</p>;
  if (q.error) return <p className="panel p-6 text-center" role="alert">{q.error.message}</p>;
  const { lesson } = q.data;
  const last = i === signs.length - 1;

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-[14px] text-muted"><Link to="/learn" className="underline-offset-2 hover:underline">Learn</Link> / {lesson.unit}</nav>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[28px] font-semibold tracking-tight">{lesson.title}</h2>
          <p className="text-[14.5px] text-muted">Sign {i + 1} of {signs.length} · use ← → to move between signs</p>
        </div>
        <Link to={`/learn/${lessonId}/test`} className="btn">Skip to the test</Link>
      </header>

      <ol className="flex flex-wrap gap-1.5" aria-label="Signs in this lesson">
        {signs.map((s, k) => (
          <li key={s.id}>
            <button
              type="button" onClick={() => setI(k)} aria-current={k === i ? 'step' : undefined}
              className={`chip !py-1 text-[13px] ${k === i ? 'border-hand bg-hand text-on-accent' : (s.progress?.box ?? -1) >= 2 ? 'border-ok/40 bg-ok/10' : 'border-line bg-surface hover:bg-surface2'}`}
            ><span className="gloss">{s.gloss}</span></button>
          </li>
        ))}
      </ol>

      {sign && (
        <section className="panel grid gap-5 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:p-6" aria-live="polite">
          <SignPlayer key={sign.id} signForm={sign.signForm} vocab={voc.vocab} gloss={sign.gloss} label={sign.gloss} loop className="mx-auto w-full max-w-[420px]" />
          <div className="flex flex-col">
            <p className="flex flex-wrap items-center gap-2"><span className="gloss text-[32px] leading-none">{sign.gloss}</span><SourceBadge sign={sign} /></p>
            <p className="mt-2 text-[16px]">{sign.meaning}</p>
            <h3 className="field-label mt-5">How to sign it</h3>
            <ul className="mt-1.5 flex flex-col items-start gap-1.5">
              {describeSign(sign.signForm, voc.vocab).map((d) => <li key={d.text}><ParamChip k={d.k}>{d.text}</ParamChip></li>)}
            </ul>
            <p className="mt-3 text-[13px] text-muted">The signer mirrors you: its right hand is on your right, like a mirror. Direction and palm orientation are approximate.</p>
            {sign.progress && <p className="mt-2 text-[13px] text-muted">Your record: {sign.progress.correct} right, {sign.progress.wrong} wrong in tests.</p>}
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
              <button type="button" className="btn" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="left" size={15} /> Previous</button>
              {last
                ? <button type="button" className="btn btn-primary" onClick={() => navigate(`/learn/${lessonId}/test`)}>Take the test <Icon name="right" size={15} /></button>
                : <button type="button" className="btn btn-primary" onClick={() => setI(i + 1)}>Next sign <Icon name="right" size={15} /></button>}
              <ReportSignButton sign={sign} page={`/learn/${lessonId}`} />
            </div>
          </div>
        </section>
      )}
      {signs.length === 0 && <p className="panel p-6 text-center text-muted">This lesson has no signs yet.</p>}
    </div>
  );
}
