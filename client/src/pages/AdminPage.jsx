import { Link } from '../lib/router.js';
import { Icon } from '../components/ui.jsx';
import { OverviewTab } from './admin/OverviewTab.jsx';
import { SignsTab } from './admin/SignsTab.jsx';
import { LessonsTab } from './admin/LessonsTab.jsx';
import { FeedbackTab } from './admin/FeedbackTab.jsx';
import { UsersTab } from './admin/UsersTab.jsx';
import { SettingsTab } from './admin/SettingsTab.jsx';
import { ActivityTab } from './admin/ActivityTab.jsx';

const TABS = [
  ['overview', 'Overview', 'chart'], ['signs', 'Signs', 'hand'], ['lessons', 'Lessons', 'book'],
  ['feedback', 'Feedback', 'chat'], ['users', 'Users', 'user'], ['settings', 'Site settings', 'sliders'], ['activity', 'Activity log', 'clock'],
];

/** The administrator dashboard: everything on the site, in one place. */
export default function AdminPage({ tab }) {
  const current = TABS.some(([k]) => k === tab) ? tab : 'overview';
  return (
    <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
      <nav aria-label="Dashboard" className="lg:sticky lg:top-3 lg:self-start">
        <p className="mb-2 hidden font-display text-[18px] font-semibold lg:block">Dashboard</p>
        <ul className="flex flex-wrap gap-1 lg:flex-col">
          {TABS.map(([k, label, icon]) => (
            <li key={k}>
              <Link to={k === 'overview' ? '/admin' : `/admin/${k}`}
                className={() => `flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-[14.5px] font-semibold ${current === k ? 'bg-hand/15 text-ink' : 'text-muted hover:bg-surface2 hover:text-ink'}`}
                aria-current={current === k ? 'page' : undefined}>
                <Icon name={icon} size={16} /> {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">
        {current === 'overview' && <OverviewTab />}
        {current === 'signs' && <SignsTab />}
        {current === 'lessons' && <LessonsTab />}
        {current === 'feedback' && <FeedbackTab />}
        {current === 'users' && <UsersTab />}
        {current === 'settings' && <SettingsTab />}
        {current === 'activity' && <ActivityTab />}
      </div>
    </div>
  );
}
