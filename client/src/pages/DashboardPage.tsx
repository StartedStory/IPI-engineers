import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { api } from '../lib/api';
import { useAuth, Permissions } from '../lib/auth';
import { STAGE_BG, type EventItem, type ProcessItem, type Developer } from '../lib/types';
import { CalendarDays, ListChecks, UserSquare2 } from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);

  useEffect(() => {
    api.get<EventItem[]>('/events').then((r) => setEvents(r.data)).catch(() => {});
    api.get<ProcessItem[]>('/processes').then((r) => setProcesses(r.data)).catch(() => {});
    if (user && Permissions.developers.view(user.role)) {
      api.get<Developer[]>('/developers').then((r) => setDevelopers(r.data)).catch(() => {});
    }
  }, [user]);

  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.start) >= now)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.name?.split(' ')[0] || ''}`}
        subtitle="Your snapshot of pipelines, schedule and team activity."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Upcoming interviews"
          value={events.filter((e) => new Date(e.start) >= now).length}
          to="/calendar"
        />
        <StatCard
          icon={<ListChecks className="h-5 w-5" />}
          label="Active processes"
          value={processes.filter((p) => p.stage !== 'onboard').length}
          to="/processes"
        />
        <StatCard
          icon={<UserSquare2 className="h-5 w-5" />}
          label="Developers in pool"
          value={developers.length}
          to="/developers"
          disabled={!user || !Permissions.developers.view(user.role)}
        />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Upcoming interviews</h3>
            <Link to="/calendar" className="text-xs text-brand-600 hover:underline">
              View calendar
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center">
              Nothing scheduled. You're all caught up.
            </div>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-50"
                >
                  <span
                    className="h-9 w-1.5 rounded"
                    style={{ background: e.color }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {e.developerName} · {e.companyName}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {e.roleTitle} · {e.interviewerName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-700">
                      {format(new Date(e.start), 'MMM d')}
                    </div>
                    <div className="text-xs text-slate-500">
                      {format(new Date(e.start), 'HH:mm')}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent processes</h3>
            <Link to="/processes" className="text-xs text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {processes.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center">No processes yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {processes.slice(0, 6).map((p) => (
                <li key={p.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {p.companyName} · {p.roleTitle}
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.developerName || '—'} · Broker {p.brokerName || '—'}
                    </div>
                  </div>
                  <span className={`badge border ${STAGE_BG[p.stage]}`}>{p.stage}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  to,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  to: string;
  disabled?: boolean;
}) {
  const inner = (
    <div className={`card p-5 ${disabled ? 'opacity-60' : 'hover:shadow-md transition-shadow'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-slate-400">{icon}</span>
      </div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
  if (disabled) return inner;
  return <Link to={to}>{inner}</Link>;
}
