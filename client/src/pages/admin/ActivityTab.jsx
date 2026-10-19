import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { fmt } from './OverviewTab.jsx';

const LABEL = {
  'user.register': 'Created an account', 'user.create': 'Created account', 'user.update': 'Changed account', 'user.delete': 'Deleted account',
  'user.password-reset': 'Reset password for', 'user.password-change': 'Changed own password',
  'sign.create': 'Created sign', 'sign.update': 'Edited sign', 'sign.delete': 'Deleted sign', 'sign.review': 'Marked reviewed', 'sign.unreview': 'Marked not reviewed',
  'lesson.create': 'Created lesson', 'lesson.update': 'Edited lesson', 'lesson.delete': 'Deleted lesson', 'lesson.signs': 'Changed signs in', 'lesson.reorder': 'Reordered lessons',
  'feedback.update': 'Updated feedback', 'feedback.delete': 'Deleted feedback', 'settings.update': 'Changed site settings',
};

/** Who changed what, and when — every admin action is recorded. */
export function ActivityTab() {
  const q = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api.get('/admin/audit?limit=300') });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-[26px] font-semibold tracking-tight">Activity log</h2>
      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-[14px]">
          <thead className="border-b border-line text-[12.5px] text-muted"><tr><th className="px-4 py-2 font-semibold">When</th><th className="font-semibold">Who</th><th className="font-semibold">What</th></tr></thead>
          <tbody className="divide-y divide-line">
            {(q.data?.entries ?? []).map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-2 text-muted">{fmt(e.createdAt)}</td>
                <td className="pr-3">{e.user ? e.user.name : <span className="text-muted">Deleted user</span>}</td>
                <td className="pr-4">{LABEL[e.action] ?? e.action} {e.target && <span className="font-semibold">{e.target}</span>}
                  {e.details && e.action === 'settings.update' && <span className="text-muted"> ({Object.keys(e.details).join(', ')})</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.isLoading && <p className="p-4 text-muted">Loading…</p>}
      </section>
    </div>
  );
}
