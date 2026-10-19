import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { Link } from '../../lib/router.js';
import { Icon } from '../../components/ui.jsx';
import { DailyColumns } from '../../components/charts.jsx';

export const fmt = (d) => (d ? new Date(d).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
export const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

export function downloadCsv(name, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  URL.revokeObjectURL(url);
}

export function Tile({ label, value, hint, to }) {
  const body = (<><p className="field-label">{label}</p><p className="mt-1 text-[28px] font-semibold leading-none">{value}</p>{hint && <p className="mt-1 text-[12.5px] text-muted">{hint}</p>}</>);
  return to ? <Link to={to} className="panel block p-4 hover:border-hand/50">{body}</Link> : <div className="panel p-4">{body}</div>;
}

/** Last 30 days, one entry per day (days without tests count as 0). */
function last30(perDay) {
  const map = new Map(perDay.map((d) => [d.day, d.tests]));
  const out = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    const key = d.toISOString().slice(0, 10);
    out.push({ label: d.toLocaleDateString([], { day: 'numeric', month: 'short' }), value: map.get(key) ?? 0 });
  }
  return out;
}

export function OverviewTab() {
  const q = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get('/admin/overview') });
  const learners = useQuery({ queryKey: ['admin', 'learners'], queryFn: () => api.get('/admin/reports/learners') });
  if (q.isLoading) return <p className="text-muted" role="status">Loading…</p>;
  if (q.error) return <p role="alert">{q.error.message}</p>;
  const o = q.data;
  const signTotal = o.signs.reduce((a, s) => a + s.n, 0);
  const reviewed = o.signs.reduce((a, s) => a + s.reviewed, 0);
  const newFeedback = o.feedback.find((f) => f.status === 'new')?.n ?? 0;
  const days = last30(o.perDay);

  return (
    <div className="space-y-5">
      <h2 className="font-display text-[26px] font-semibold tracking-tight">Overview</h2>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Accounts" value={o.users.total} hint={`${o.users.admins} admin${o.users.admins === 1 ? '' : 's'}`} to="/admin/users" />
        <Tile label="Active learners (7 days)" value={o.learning.active7} />
        <Tile label="Tests (30 days)" value={o.learning.tests30} hint={`Average score ${pct(o.learning.avg_score)}`} />
        <Tile label="Signs" value={signTotal.toLocaleString()} hint={`${reviewed} reviewed by an admin`} to="/admin/signs" />
        <Tile label="Lessons" value={o.learning.lessons} to="/admin/lessons" />
        <Tile label="New feedback" value={newFeedback} hint="Waiting for a reply" to="/admin/feedback" />
      </section>

      <section className="panel p-4">
        <h3 className="font-semibold">Tests taken per day</h3>
        <p className="mb-2 text-[13px] text-muted">Last 30 days.</p>
        <DailyColumns days={days} title="Tests taken per day, last 30 days" />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-4">
          <h3 className="font-semibold">Most-missed signs</h3>
          <p className="mb-2 text-[13px] text-muted">Answered wrong most often (at least 3 answers). A sign many learners miss may be unclear — or wrong.</p>
          {o.missed.length ? (
            <table className="w-full text-[14px]"><tbody className="divide-y divide-line">
              {o.missed.map((m) => (
                <tr key={m.id}><td className="py-1.5"><span className="gloss">{m.gloss}</span></td>
                  <td className="text-right tabular-nums text-muted">{m.wrong} wrong / {m.wrong + m.correct}</td>
                  <td className="w-[80px] text-right"><Link to={`/admin/signs?edit=${m.id}`} className="text-[13px] font-semibold underline-offset-2 hover:underline">Edit</Link></td></tr>
              ))}
            </tbody></table>
          ) : <p className="text-[14px] text-muted">Not enough test answers yet.</p>}
        </section>
        <section className="panel p-4">
          <h3 className="font-semibold">Most-reported signs</h3>
          <p className="mb-2 text-[13px] text-muted">From “a sign looks wrong” feedback.</p>
          {o.reported.length ? (
            <table className="w-full text-[14px]"><tbody className="divide-y divide-line">
              {o.reported.map((m) => (
                <tr key={`${m.gloss}-${m.gesture_id}`}><td className="py-1.5"><span className="gloss">{m.gloss}</span></td>
                  <td className="text-right text-muted">{m.n} report{m.n > 1 ? 's' : ''}{m.open ? ` · ${m.open} open` : ''}</td>
                  <td className="w-[80px] text-right">{m.gesture_id && <Link to={`/admin/signs?edit=${m.gesture_id}`} className="text-[13px] font-semibold underline-offset-2 hover:underline">Edit</Link>}</td></tr>
              ))}
            </tbody></table>
          ) : <p className="text-[14px] text-muted">No sign reports.</p>}
        </section>
      </div>

      <section className="panel overflow-x-auto p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Learner report</h3>
          {learners.data && (
            <button type="button" className="btn !min-h-[36px] text-[13.5px]" onClick={() => downloadCsv('signsense-learners.csv', [
              ['Name', 'Email', 'Role', 'Joined', 'Last active', 'Signs studied', 'Signs learned', 'Lessons completed', 'Tests', 'Average score'],
              ...learners.data.learners.map((l) => [l.name, l.email, l.role, l.created_at, l.last_active, l.studied, l.learned, l.lessons_completed, l.tests, l.avg_score == null ? '' : Math.round(l.avg_score * 100)]),
            ])}><Icon name="download" size={15} /> Download CSV</button>
          )}
        </div>
        {learners.data && (
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead className="text-[12.5px] text-muted"><tr>{['Learner', 'Last active', 'Studied', 'Learned', 'Lessons done', 'Tests', 'Avg score'].map((h) => <th key={h} className="py-1.5 pr-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {learners.data.learners.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pr-3"><span className="font-semibold">{l.name}</span> <span className="text-muted">{l.email}</span>{l.role === 'admin' && <span className="ml-1 rounded bg-surface2 px-1 text-[11.5px] font-bold">admin</span>}</td>
                  <td className="pr-3 text-muted">{fmt(l.last_active)}</td>
                  <td className="pr-3 tabular-nums">{l.studied}</td><td className="pr-3 tabular-nums">{l.learned}</td>
                  <td className="pr-3 tabular-nums">{l.lessons_completed}</td><td className="pr-3 tabular-nums">{l.tests}</td>
                  <td className="tabular-nums">{pct(l.avg_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
