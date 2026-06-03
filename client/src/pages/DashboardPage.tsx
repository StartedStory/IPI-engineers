import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Avatar } from '../components/Avatar';
import { api } from '../lib/api';
import { useAuth, Permissions } from '../lib/auth';
import {
  STAGE_BG,
  type Availability,
  type EventItem,
  type ProcessItem,
  type Developer,
} from '../lib/types';
import { CalendarClock, CalendarDays, ListChecks, UserSquare2 } from 'lucide-react';
import { addDays, format, isSameDay } from 'date-fns';

export default function DashboardPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);

  useEffect(() => {
    api.get<EventItem[]>('/events').then((r) => setEvents(r.data)).catch(() => {});
    api.get<ProcessItem[]>('/processes').then((r) => setProcesses(r.data)).catch(() => {});
    if (user && Permissions.developers.view(user.role)) {
      api.get<Developer[]>('/developers').then((r) => setDevelopers(r.data)).catch(() => {});
    }
    if (user && Permissions.availability.view(user.role)) {
      api
        .get<Availability[]>('/availability')
        .then((r) => setAvailability(r.data))
        .catch(() => {});
    }
  }, [user]);

  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.start) >= now)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .slice(0, 5);

  const today = new Date();
  const tomorrow = addDays(today, 1);

  // Group each interviewer's free slots for today / tomorrow, ordered by start.
  const availableInterviewers = useMemo(() => {
    const byName = new Map<string, { today: Availability[]; tomorrow: Availability[] }>();
    for (const slot of availability) {
      const start = new Date(slot.start);
      const bucket = isSameDay(start, today) ? 'today' : isSameDay(start, tomorrow) ? 'tomorrow' : null;
      if (!bucket) continue;
      const name = slot.interviewerName.trim();
      if (!name) continue;
      if (!byName.has(name)) byName.set(name, { today: [], tomorrow: [] });
      byName.get(name)![bucket].push(slot);
    }
    const sortByStart = (a: Availability, b: Availability) => +new Date(a.start) - +new Date(b.start);
    return [...byName.entries()]
      .map(([name, slots]) => ({
        name,
        today: slots.today.sort(sortByStart),
        tomorrow: slots.tomorrow.sort(sortByStart),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability]);

  const fmtRange = (s: Availability) =>
    `${format(new Date(s.start), 'HH:mm')}–${format(new Date(s.end), 'HH:mm')}`;

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

      {user && Permissions.availability.view(user.role) && (
        <div className="card p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-slate-400" />
              Available interviewers · today &amp; tomorrow
            </h3>
            <Link to="/availability" className="text-xs text-brand-600 hover:underline">
              View availability
            </Link>
          </div>
          {availableInterviewers.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center">
              No interviewer availability set for today or tomorrow.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {availableInterviewers.map((iv) => (
                <li key={iv.name} className="py-3 flex items-start gap-3">
                  <Avatar name={iv.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">{iv.name}</div>
                    <div className="mt-1 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                      <DayLine label="Today" slots={iv.today} fmt={fmtRange} />
                      <DayLine label="Tomorrow" slots={iv.tomorrow} fmt={fmtRange} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function DayLine({
  label,
  slots,
  fmt,
}: {
  label: string;
  slots: Availability[];
  fmt: (s: Availability) => string;
}) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="font-semibold text-slate-500 w-16 shrink-0">{label}</span>
      {slots.length === 0 ? (
        <span className="text-slate-400">Not available</span>
      ) : (
        <span className="flex flex-wrap gap-1.5">
          {slots.map((s) => (
            <span
              key={s.id}
              className="inline-flex rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 font-medium"
            >
              {fmt(s)}
            </span>
          ))}
        </span>
      )}
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
