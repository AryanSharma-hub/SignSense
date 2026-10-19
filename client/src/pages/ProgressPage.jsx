import { Link } from '../lib/router.js';
import { Icon } from '../components/ui.jsx';
import { ScoreLine } from '../components/charts.jsx';
import { ProgressBar } from './LearnPage.jsx';
import { useReport } from '../hooks/useLearn.js';

const fmtDate = (d) => new Date(d).toLocaleDateString([], { day: 'numeric', month: 'short' });
const fmtDateTime = (d) => new Date(d).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Download the learner's test history as CSV. */
function downloadCsv(tests) {
  const rows = [['Date', 'Kind', 'Lesson', 'Score', 'Total', 'Percent'],
    ...tests.map((t) => [new Date(t.finished_at).toISOString(), t.kind, t.lesson ?? 'Review', t.score, t.total, Math.round((t.score / t.total) * 100)])];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'signsense-progress.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

/** The learner's report: totals, units, scores over time, weakest signs, test history. */
export default function ProgressPage() {
  const q = useReport();
  if (q.isLoading) return <p className="py-16 text-center text-muted" role="status">Loading your report…</p>;
  if (q.error) return <p className="panel p-6 text-center" role="alert">{q.error.message}</p>;
  const { totals: t, units, tests, weakest } = q.data;
  const chronological = [...tests].reverse().slice(-20);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[28px] font-semibold tracking-tight">Your progress</h2>
          <p className="text-[14.5px] text-muted">Scores come from server-checked tests; “learned” means answered right on two separate occasions.</p>
        </div>
        {tests.length > 0 && <button type="button" className="btn" onClick={() => downloadCsv(tests)}><Icon name="download" size={15} /> Download report (CSV)</button>}
      </header>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[['Signs studied', t.studied], ['Learned', t.learned], ['Mastered', t.mastered], ['Due for review', t.due],
          ['Day streak', t.streak], ['Accuracy', t.accuracy == null ? '—' : `${Math.round(t.accuracy * 100)}%`]].map(([label, v]) => (
          <div key={label} className="panel p-4"><p className="field-label">{label}</p><p className="mt-1 text-[28px] font-semibold leading-none">{v}</p></div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel p-4">
          <h3 className="font-semibold">Test scores over time</h3>
          <p className="mb-2 text-[13px] text-muted">Your last {chronological.length} tests. The 80% line is the usual pass mark.</p>
          {chronological.length
            ? <ScoreLine title="Test scores over time" points={chronological.map((x) => ({ value: x.score / x.total, label: `${x.lesson ?? 'Review'} · ${fmtDateTime(x.finished_at)}`, axis: fmtDate(x.finished_at) }))} />
            : <p className="rounded-xl bg-surface2 p-4 text-[14px] text-muted">No tests yet. Finish a lesson and take its test to see your scores here.</p>}
        </section>

        <section className="panel p-4">
          <h3 className="font-semibold">Signs to practise</h3>
          <p className="mb-2 text-[13px] text-muted">The ones you miss most often.</p>
          {weakest.length ? (
            <ul className="divide-y divide-line">
              {weakest.map((w) => (
                <li key={w.gestureId} className="flex items-center gap-3 py-2">
                  <span className="gloss">{w.gloss}</span>
                  <span className="ml-auto text-[13px] text-muted">{w.correct} right · {w.wrong} wrong</span>
                </li>
              ))}
            </ul>
          ) : <p className="rounded-xl bg-surface2 p-4 text-[14px] text-muted">Nothing yet — no missed signs.</p>}
          {t.studied > 1 && <Link to="/review" className="btn btn-primary mt-3 w-full">Review these now</Link>}
        </section>
      </div>

      <section className="panel p-4">
        <h3 className="mb-3 font-semibold">Lessons completed by unit</h3>
        <ul className="grid gap-x-6 gap-y-3 md:grid-cols-2">
          {units.map((u) => (
            <li key={u.unit}>
              <div className="mb-1 flex justify-between text-[14px]"><span>{u.unit}</span><span className="text-muted">{u.completed}/{u.total}</span></div>
              <ProgressBar value={u.total ? u.completed / u.total : 0} label={`${u.unit}: ${u.completed} of ${u.total} lessons completed`} />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel overflow-x-auto p-4">
        <h3 className="mb-2 font-semibold">Test history</h3>
        {tests.length ? (
          <table className="w-full min-w-[520px] text-left text-[14px]">
            <thead className="text-[12.5px] text-muted"><tr><th className="py-1.5 font-semibold">When</th><th className="font-semibold">Test</th><th className="text-right font-semibold">Score</th></tr></thead>
            <tbody className="divide-y divide-line">
              {tests.map((x) => (
                <tr key={x.id}>
                  <td className="py-2">{fmtDateTime(x.finished_at)}</td>
                  <td>{x.lesson ?? 'Spaced review'}</td>
                  <td className="text-right font-semibold tabular-nums">{x.score}/{x.total} <span className="text-muted">({Math.round((x.score / x.total) * 100)}%)</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-[14px] text-muted">No tests taken yet.</p>}
      </section>
    </div>
  );
}
