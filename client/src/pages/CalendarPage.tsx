import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { api } from '../lib/api';
import { useAuth, Permissions } from '../lib/auth';
import {
  STAGES,
  STAGE_COLOR,
  type Developer,
  type EventItem,
  type Stage,
  type Teammate,
} from '../lib/types';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  addDays,
} from 'date-fns';
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Plus, Trash2 } from 'lucide-react';

const PRESET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const CURATED_TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Bucharest',
  'Europe/Istanbul',
  'Africa/Cairo',
  'Asia/Tehran',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

// Always include the viewer's own timezone, then the curated set (deduped).
const TIMEZONES: string[] = Array.from(new Set([BROWSER_TZ, ...CURATED_TIMEZONES]));

// Offset (in ms) of `timeZone` relative to UTC at the given instant. Positive = east of UTC.
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  const hour = map.hour === 24 ? 0 : map.hour;
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second);
  return asUTC - date.getTime();
}

// "GMT+2" style hint for a timezone at the current moment.
function gmtLabel(timeZone: string): string {
  const minutes = Math.round(tzOffsetMs(new Date(), timeZone) / 60000);
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

const TZ_OPTIONS = TIMEZONES.map((tz) => ({ tz, label: `${tz} (${gmtLabel(tz)})` }));

// UTC ISO -> "YYYY-MM-DDTHH:mm" wall-clock string in `timeZone` (for datetime-local inputs).
function isoToZonedInput(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const wall = new Date(d.getTime() + tzOffsetMs(d, timeZone));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`;
}

// "YYYY-MM-DDTHH:mm" wall-clock string in `timeZone` -> UTC ISO string.
function zonedInputToISO(input: string, timeZone: string): string {
  const [datePart, timePart] = input.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = (timePart || '00:00').split(':').map(Number);
  const asUTC = Date.UTC(y, mo - 1, d, h, mi, 0);
  // Resolve the offset at the candidate instant, then refine once for DST boundaries.
  let offset = tzOffsetMs(new Date(asUTC), timeZone);
  offset = tzOffsetMs(new Date(asUTC - offset), timeZone);
  return new Date(asUTC - offset).toISOString();
}

export default function CalendarPage() {
  const { user } = useAuth();
  const canEdit = !!user && Permissions.calendar.edit(user.role);
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [devs, setDevs] = useState<Developer[]>([]);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [editing, setEditing] = useState<Partial<EventItem> | null>(null);
  const [viewing, setViewing] = useState<EventItem | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await api.get<EventItem[]>('/events');
    setEvents(r.data);
  }
  useEffect(() => {
    load();
    if (user && Permissions.developers.view(user.role)) {
      api.get<Developer[]>('/developers').then((r) => setDevs(r.data)).catch(() => {});
    }
    if (user && Permissions.teammates.view(user.role)) {
      api.get<Teammate[]>('/teammates').then((r) => setTeammates(r.data)).catch(() => {});
    }
  }, [user]);

  const interviewers = teammates.filter((t) => t.role === 'interviewer');

  const cells = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of events) {
      const key = format(new Date(e.start), 'yyyy-MM-dd');
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    for (const [k, list] of map) {
      list.sort((a, b) => +new Date(a.start) - +new Date(b.start));
      map.set(k, list);
    }
    return map;
  }, [events]);

  function openNew(date?: Date) {
    const start = date || new Date();
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setEditing({
      developerName: '',
      interviewerName: '',
      recruiterName: user?.role === 'bidder' ? user.name : '',
      start: start.toISOString(),
      end: end.toISOString(),
      timezone: BROWSER_TZ,
      meetingLink: '',
      jdLink: '',
      roleTitle: '',
      companyName: '',
      color: STAGE_COLOR.intro,
      status: 'scheduled',
      processStage: 'intro',
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      if (editing.id) {
        await api.put(`/events/${editing.id}`, editing);
      } else {
        await api.post('/events', editing);
      }
      setEditing(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function markDone(ev: EventItem) {
    await api.put(`/events/${ev.id}`, { status: ev.status === 'done' ? 'scheduled' : 'done' });
    setViewing(null);
    load();
  }
  async function remove(ev: EventItem) {
    if (!confirm('Delete this event?')) return;
    await api.delete(`/events/${ev.id}`);
    setViewing(null);
    load();
  }

  const monthLabel = format(cursor, 'MMMM yyyy');
  const today = new Date();

  return (
    <div>
      <PageHeader
        title="Schedule"
        subtitle={
          user?.role === 'interviewer'
            ? 'Showing only interviews assigned to you. Mark them as done after completion.'
            : 'Add, edit and color-code interviews. Interviewers see only their own.'
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-slate-200 rounded-md">
              <button
                className="p-2 text-slate-500 hover:bg-slate-50 rounded-l-md"
                onClick={() => setCursor(addMonths(cursor, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="px-3 text-sm font-semibold w-36 text-center">{monthLabel}</div>
              <button
                className="p-2 text-slate-500 hover:bg-slate-50 rounded-r-md"
                onClick={() => setCursor(addMonths(cursor, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button className="btn-secondary" onClick={() => setCursor(new Date())}>
              Today
            </button>
            {canEdit && (
              <button className="btn-primary" onClick={() => openNew()}>
                <Plus className="h-4 w-4" /> New event
              </button>
            )}
          </div>
        }
      />

      <div className="card">
        <div className="calendar-grid border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="px-3 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((d) => {
            const key = format(d, 'yyyy-MM-dd');
            const list = eventsByDay.get(key) || [];
            const otherMonth = !isSameMonth(d, cursor);
            const isToday = isSameDay(d, today);
            return (
              <div
                key={key}
                className={`calendar-cell border-b border-r border-slate-100 p-1.5 flex flex-col ${
                  otherMonth ? 'bg-slate-50/40' : 'bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={() => canEdit && openNew(d)}
                    className={`text-xs font-semibold w-6 h-6 grid place-items-center rounded-full ${
                      isToday
                        ? 'bg-brand-500 text-white'
                        : otherMonth
                          ? 'text-slate-400'
                          : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {format(d, 'd')}
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => openNew(d)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-brand-500"
                      title="Add event"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="space-y-1 overflow-hidden">
                  {list.slice(0, 4).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setViewing(e)}
                      className={`w-full text-left text-[11px] px-1.5 py-1 rounded truncate flex items-center gap-1.5 hover:brightness-95 ${
                        e.status === 'done' ? 'line-through opacity-70' : ''
                      }`}
                      style={{
                        background: e.color + '22',
                        color: e.color,
                        borderLeft: `3px solid ${e.color}`,
                      }}
                      title={`${e.developerName} · ${e.companyName} · ${e.roleTitle}`}
                    >
                      <span className="font-semibold">{format(new Date(e.start), 'HH:mm')}</span>
                      <span className="truncate">
                        {e.developerName || 'Event'} · {e.companyName || ''}
                      </span>
                    </button>
                  ))}
                  {list.length > 4 && (
                    <div className="text-[11px] text-slate-500">+{list.length - 4} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit event' : 'New event'}
        size="lg"
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Developer</label>
                {devs.length > 0 ? (
                  <select
                    className="input"
                    value={editing.developerId || ''}
                    onChange={(e) => {
                      const d = devs.find((x) => x.id === e.target.value);
                      setEditing({
                        ...editing,
                        developerId: d?.id || null,
                        developerName: d?.name || '',
                      });
                    }}
                  >
                    <option value="">— Select developer —</option>
                    {devs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    value={editing.developerName || ''}
                    onChange={(e) => setEditing({ ...editing, developerName: e.target.value })}
                  />
                )}
              </div>
              <div>
                <label className="label">Interviewer</label>
                {interviewers.length > 0 ? (
                  <select
                    className="input"
                    value={editing.interviewerName || ''}
                    onChange={(e) =>
                      setEditing({ ...editing, interviewerName: e.target.value })
                    }
                  >
                    <option value="">— Select interviewer —</option>
                    {interviewers.map((i) => (
                      <option key={i.id} value={i.name}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    value={editing.interviewerName || ''}
                    onChange={(e) =>
                      setEditing({ ...editing, interviewerName: e.target.value })
                    }
                    placeholder="Assigned interviewer name"
                  />
                )}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Recruiter / Bidder</label>
                <input
                  className="input"
                  value={editing.recruiterName || ''}
                  onChange={(e) => setEditing({ ...editing, recruiterName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Company</label>
                <input
                  className="input"
                  value={editing.companyName || ''}
                  onChange={(e) => setEditing({ ...editing, companyName: e.target.value })}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Role title</label>
                <input
                  className="input"
                  value={editing.roleTitle || ''}
                  onChange={(e) => setEditing({ ...editing, roleTitle: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Stage</label>
                <select
                  className="input"
                  value={editing.processStage}
                  onChange={(e) => {
                    const stage = e.target.value as Stage;
                    setEditing({ ...editing, processStage: stage, color: STAGE_COLOR[stage] });
                  }}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Timezone</label>
              <select
                className="input"
                value={editing.timezone || BROWSER_TZ}
                onChange={(e) => setEditing({ ...editing, timezone: e.target.value })}
              >
                {TZ_OPTIONS.map((o) => (
                  <option key={o.tz} value={o.tz}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Start and end times below are entered in this timezone.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Start</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={editing.start ? isoToZonedInput(editing.start, editing.timezone || BROWSER_TZ) : ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      start: zonedInputToISO(e.target.value, editing.timezone || BROWSER_TZ),
                    })
                  }
                />
              </div>
              <div>
                <label className="label">End</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={editing.end ? isoToZonedInput(editing.end, editing.timezone || BROWSER_TZ) : ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      end: zonedInputToISO(e.target.value, editing.timezone || BROWSER_TZ),
                    })
                  }
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Meeting link</label>
                <input
                  className="input"
                  value={editing.meetingLink || ''}
                  onChange={(e) => setEditing({ ...editing, meetingLink: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Job description link</label>
                <input
                  className="input"
                  value={editing.jdLink || ''}
                  onChange={(e) => setEditing({ ...editing, jdLink: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Color</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditing({ ...editing, color: c })}
                    className={`h-7 w-7 rounded-full border-2 ${
                      editing.color === c ? 'border-slate-900' : 'border-transparent'
                    }`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
                <input
                  type="color"
                  value={editing.color || '#3b82f6'}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  className="h-7 w-7 rounded cursor-pointer border border-slate-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={save} disabled={busy || !editing.start}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Event details" size="md">
        {viewing && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: viewing.color }}
                aria-hidden
              />
              <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {viewing.processStage}
              </span>
              {viewing.status === 'done' && (
                <span className="badge bg-emerald-100 text-emerald-700 border border-emerald-200">
                  Done
                </span>
              )}
            </div>
            <div className="text-xl font-bold">{viewing.developerName}</div>
            <div className="text-sm text-slate-600">
              {viewing.roleTitle} · {viewing.companyName}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="When">
                {format(new Date(viewing.start), 'EEE, MMM d · HH:mm')}
                {' — '}
                {format(new Date(viewing.end), 'HH:mm')}
              </Info>
              <Info label="Interviewer">{viewing.interviewerName || '—'}</Info>
              <Info label="Recruiter">{viewing.recruiterName || '—'}</Info>
              <Info label="Status">{viewing.status}</Info>
              {viewing.timezone && (
                <Info label="Set in timezone">
                  {isoToZonedInput(viewing.start, viewing.timezone).slice(11)} · {viewing.timezone}{' '}
                  ({gmtLabel(viewing.timezone)})
                </Info>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Meeting link">
                {viewing.meetingLink ? (
                  <a
                    className="text-brand-600 hover:underline inline-flex items-center gap-1"
                    href={viewing.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Join <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  '—'
                )}
              </Info>
              <Info label="Job description">
                {viewing.jdLink ? (
                  <a
                    className="text-brand-600 hover:underline inline-flex items-center gap-1"
                    href={viewing.jdLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  '—'
                )}
              </Info>
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <div>
                {canEdit && (
                  <button className="btn-danger" onClick={() => remove(viewing)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {Permissions.calendar.markDone(user!.role) && (
                  <button className="btn-secondary" onClick={() => markDone(viewing)}>
                    <CheckCircle2 className="h-4 w-4" />
                    {viewing.status === 'done' ? 'Mark not done' : 'Mark done'}
                  </button>
                )}
                {canEdit && (
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setEditing(viewing);
                      setViewing(null);
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
        {label}
      </div>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}
