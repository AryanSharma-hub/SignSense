import { useMemo } from 'react';
import { Link } from '../lib/router.js';
import { Icon } from '../components/ui.jsx';
import { useLessons, useReport } from '../hooks/useLearn.js';
import { useAuth } from '../hooks/useAuth.js';

function ProgressBar({ value, label }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full bg-chart transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
export { ProgressBar };

/** Course overview: units, lessons and where the learner is. */
export default function LearnPage() {
  const { user } = useAuth();
  const q = useLessons();
  const report = useReport();
  const units = useMemo(() => {
    const out = [];
    for (const l of q.data?.lessons || []) {
      let u = out.find((x) => x.name === l.unit);
      if (!u) out.push((u = { name: l.unit, lessons: [] }));
      u.lessons.push(l);
    }
    return out;
  }, [q.data]);
  const next = (q.data?.lessons || []).find((l) => !l.completed);
  const t = report.data?.totals;

  if (q.isLoading) return <p className="py-16 text-center text-muted" role="status">Loading lessons…</p>;
  if (q.error) return <p className="panel p-6 text-center" role="alert">{q.error.message}</p>;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel p-5">
          <p className="field-label">Hi {user?.name?.split(' ')[0]}</p>
          <h2 className="font-display text-[26px] font-semibold tracking-tight">{next ? 'Pick up where you left off' : 'You’ve completed every lesson'}</h2>
          {next ? (
            <>
              <p className="mt-1 text-[15px] text-muted">{next.title} · {next.total} signs</p>
              <div className="mt-3 max-w-md"><ProgressBar value={next.total ? next.learned / next.total : 0} label={`${next.title} progress`} /></div>
              <Link to={`/learn/${next.id}`} className="btn btn-primary mt-4"><Icon name="play" size={14} /> {next.studied ? 'Continue lesson' : 'Start lesson'}</Link>
            </>
          ) : <p className="mt-1 text-[15px] text-muted">Keep signs fresh with a review, or retake any lesson test.</p>}
        </div>
        <div className="panel flex flex-col justify-between p-5">
          <div>
            <p className="field-label">Review</p>
            <p className="mt-1 font-display text-[40px] font-semibold leading-none">{q.data.dueCount}</p>
            <p className="text-[14px] text-muted">{q.data.dueCount === 1 ? 'sign is' : 'signs are'} due for review. Spaced review brings back each sign just before you’d forget it.</p>
          </div>
          <Link to="/review" className={`btn mt-3 ${q.data.dueCount ? 'btn-primary' : ''}`} aria-disabled={!t?.studied}>Start a review</Link>
        </div>
      </section>

      {t && (
        <section aria-label="Your numbers" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Signs learned', t.learned], ['Mastered', t.mastered], ['Day streak', t.streak], ['Accuracy', t.accuracy == null ? '—' : `${Math.round(t.accuracy * 100)}%`]].map(([label, v]) => (
            <div key={label} className="panel p-4"><p className="field-label">{label}</p><p className="mt-1 text-[26px] font-semibold leading-none">{v}</p></div>
          ))}
        </section>
      )}

      {units.map((u) => (
        <section key={u.name} aria-labelledby={`unit-${u.name}`}>
          <h3 id={`unit-${u.name}`} className="mb-2 font-display text-[19px] font-semibold">{u.name}</h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {u.lessons.map((l) => (
              <li key={l.id}>
                <Link to={`/learn/${l.id}`} className="panel flex h-full flex-col gap-2 p-4 transition-colors hover:border-hand/50">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[16px] font-semibold">{l.title}</span>
                    {l.completed && <span className="inline-flex items-center gap-1 rounded-md bg-ok/15 px-1.5 py-0.5 text-[12px] font-bold text-ok"><Icon name="check" size={12} /> Done</span>}
                  </span>
                  <span className="line-clamp-2 text-[13.5px] text-muted">{l.description}</span>
                  <span className="mt-auto flex items-center gap-2 text-[12.5px] text-muted">
                    <ProgressBar value={l.total ? l.learned / l.total : 0} label={`${l.title}: ${l.learned} of ${l.total} learned`} />
                    <span className="shrink-0">{l.learned}/{l.total}</span>
                  </span>
                  {l.bestScore != null && <span className="text-[12.5px] text-muted">Best test score {Math.round(l.bestScore * 100)}%</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {units.length === 0 && <p className="panel p-6 text-center text-muted">No lessons are published yet.</p>}
    </div>
  );
}
