import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { api } from '../lib/api';
import { useAuth, Permissions } from '../lib/auth';
import type { Availability, Teammate } from '../lib/types';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const DAY_START = 7;
const DAY_END = 23;
const HOURS = DAY_END - DAY_START;
const SNAP_MIN = 30;
const MIN_DUR = 0.5;
const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const INTERVIEWER_COLORS = [
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#64748b',
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (h: number) => Math.round((h * 60) / SNAP_MIN) * (SNAP_MIN / 60);
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function xToHour(rect: DOMRect, clientX: number): number {
  const ratio = rect.width ? (clientX - rect.left) / rect.width : 0;
  return clamp(DAY_START + ratio * HOURS, DAY_START, DAY_END);
}

function dayHourToISO(day: Date, hour: number): string {
  const d = new Date(day);
  const hh = Math.floor(hour);
  const mm = Math.round((hour - hh) * 60);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

function slotStartH(s: Availability): number {
  const d = new Date(s.start);
  return d.getHours() + d.getMinutes() / 60;
}
function slotEndH(s: Availability): number {
  const d = new Date(s.end);
  let h = d.getHours() + d.getMinutes() / 60;
  if (h <= slotStartH(s)) h = DAY_END;
  return clamp(h, DAY_START, DAY_END);
}

type DragMode = 'create' | 'move' | 'resize-l' | 'resize-r';
type DragState = {
  mode: DragMode;
  dayIndex: number;
  interviewerName: string;
  rect: DOMRect;
  slotId: string | null;
  anchorH: number;
  grabH: number;
  origStartH: number;
  origEndH: number;
  moved: boolean;
};
type Draft = {
  dayIndex: number;
  interviewerName: string;
  startH: number;
  endH: number;
  slotId: string | null;
};

export default function AvailabilityPage() {
  const { user } = useAuth();
  const isInterviewer = user?.role === 'interviewer';
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [slots, setSlots] = useState<Availability[]>([]);
  const [interviewers, setInterviewers] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const liveRef = useRef<{ startH: number; endH: number } | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const visibleInterviewers = useMemo(() => {
    if (isInterviewer) return user ? [user.name] : [];
    const fromTeammates = interviewers;
    const fromSlots = slots.map((s) => s.interviewerName).filter(Boolean);
    return [...new Set([...fromTeammates, ...fromSlots])].sort((a, b) => a.localeCompare(b));
  }, [interviewers, slots, isInterviewer, user]);

  const colorFor = useMemo(() => {
    const map = new Map<string, string>();
    visibleInterviewers.forEach((name, i) => {
      map.set(name.toLowerCase(), INTERVIEWER_COLORS[i % INTERVIEWER_COLORS.length]);
    });
    return (name: string) => map.get(name.toLowerCase()) || INTERVIEWER_COLORS[0];
  }, [visibleInterviewers]);

  function canEdit(name: string) {
    if (!user || !Permissions.availability.edit(user.role)) return false;
    if (user.role === 'manager') return true;
    if (user.role === 'interviewer') return sameName(user.name, name);
    return false;
  }

  const canEditAny = visibleInterviewers.some((n) => canEdit(n));

  async function load() {
    const r = await api.get<Availability[]>('/availability');
    setSlots(r.data);
  }

  useEffect(() => {
    load();
    if (!isInterviewer && user) {
      api
        .get<Teammate[]>('/teammates')
        .then((r) => {
          const names = r.data.filter((t) => t.role === 'interviewer').map((t) => t.name);
          setInterviewers(names);
        })
        .catch(() => {});
    }
  }, [user, isInterviewer]);

  function slotsFor(name: string, day: Date) {
    return slots.filter(
      (s) => sameName(s.interviewerName, name) && isSameDay(new Date(s.start), day)
    );
  }

  function beginDrag(
    mode: DragMode,
    dayIndex: number,
    interviewerName: string,
    e: React.PointerEvent,
    slot?: Availability
  ) {
    if (!canEdit(interviewerName)) return;
    e.preventDefault();
    e.stopPropagation();
    const trackEl = (e.currentTarget as HTMLElement).closest('[data-track]') as HTMLElement | null;
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const h = xToHour(rect, e.clientX);
    const startH = mode === 'create' ? snap(h) : slot ? slotStartH(slot) : snap(h);
    const endH = mode === 'create' ? snap(h) : slot ? slotEndH(slot) : snap(h);
    dragRef.current = {
      mode,
      dayIndex,
      interviewerName,
      rect,
      slotId: slot?.id ?? null,
      anchorH: snap(h),
      grabH: h,
      origStartH: startH,
      origEndH: endH,
      moved: false,
    };
    liveRef.current = { startH, endH };
    setDraft({ dayIndex, interviewerName, startH, endH, slotId: slot?.id ?? null });
    try {
      trackEl.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onTrackPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const h = xToHour(d.rect, e.clientX);
    let startH = d.origStartH;
    let endH = d.origEndH;
    if (d.mode === 'create') {
      const cur = snap(h);
      startH = Math.min(d.anchorH, cur);
      endH = Math.max(d.anchorH, cur);
    } else if (d.mode === 'move') {
      const dur = d.origEndH - d.origStartH;
      const ns = clamp(snap(d.origStartH + (h - d.grabH)), DAY_START, DAY_END - dur);
      startH = ns;
      endH = ns + dur;
    } else if (d.mode === 'resize-l') {
      startH = clamp(snap(h), DAY_START, d.origEndH - MIN_DUR);
      endH = d.origEndH;
    } else if (d.mode === 'resize-r') {
      startH = d.origStartH;
      endH = clamp(snap(h), d.origStartH + MIN_DUR, DAY_END);
    }
    d.moved = true;
    liveRef.current = { startH, endH };
    setDraft({
      dayIndex: d.dayIndex,
      interviewerName: d.interviewerName,
      startH,
      endH,
      slotId: d.slotId,
    });
  }

  async function onTrackPointerUp() {
    const d = dragRef.current;
    const live = liveRef.current;
    dragRef.current = null;
    liveRef.current = null;
    setDraft(null);
    if (!d || !live) return;
    const day = days[d.dayIndex];
    const { startH, endH } = live;
    try {
      if (d.mode === 'create') {
        if (endH - startH < MIN_DUR) return;
        await api.post('/availability', {
          interviewerName: d.interviewerName,
          start: dayHourToISO(day, startH),
          end: dayHourToISO(day, endH),
          timezone: BROWSER_TZ,
        });
      } else {
        if (!d.moved || !d.slotId) return;
        await api.put(`/availability/${d.slotId}`, {
          start: dayHourToISO(day, startH),
          end: dayHourToISO(day, endH),
        });
      }
      await load();
    } catch {
      await load();
    }
  }

  async function removeSlot(id: string) {
    try {
      await api.delete(`/availability/${id}`);
    } finally {
      load();
    }
  }

  const hourTicks = Array.from({ length: HOURS + 1 }, (_, i) => DAY_START + i);

  return (
    <div className="select-none">
      <PageHeader
        title="Interviewer Availability"
        subtitle="Compare when each interviewer is free. Times are shown in your local timezone."
        actions={
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold text-slate-700 w-44 text-center">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </div>
            <button
              className="p-2 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              className="btn-secondary"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            >
              This week
            </button>
          </div>
        }
      />

      {visibleInterviewers.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {visibleInterviewers.map((name) => (
            <div key={name} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: colorFor(name) }}
              />
              <span className={isInterviewer && sameName(name, user!.name) ? 'font-semibold' : ''}>
                {name}
                {isInterviewer && sameName(name, user!.name) ? ' (you)' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {canEditAny ? (
        <p className="text-[12px] text-slate-500 mb-4">
          Drag on a row to add availability · drag the ends to resize · drag the middle to move ·
          click <span className="font-semibold">×</span> to remove.
          {user?.role === 'manager' && ' Managers can edit any interviewer.'}
        </p>
      ) : (
        <p className="text-[12px] text-slate-500 mb-4">Read-only view.</p>
      )}

      {visibleInterviewers.length === 0 ? (
        <div className="rounded-xl border border-slate-300 bg-slate-100 p-8 text-center text-sm text-slate-500">
          No interviewers found. Add interviewers in the Teammates page first.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-300 bg-slate-100 overflow-hidden">
          {/* Hour ruler */}
          <div className="flex border-b border-slate-300 bg-slate-200 sticky top-0 z-10">
            <div className="w-36 shrink-0 px-3 py-2 text-[11px] font-semibold text-slate-400">
              Day / Interviewer
            </div>
            <div className="relative flex-1 h-8">
              {hourTicks.map((h) =>
                (h - DAY_START) % 2 === 0 ? (
                  <span
                    key={h}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[10px] text-slate-400"
                    style={{ left: `${((h - DAY_START) / HOURS) * 100}%` }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </span>
                ) : null
              )}
            </div>
          </div>

          {/* Day sections with stacked interviewer rows */}
          {days.map((day, dayIndex) => {
            const isToday = isSameDay(day, new Date());
            return (
              <div key={dayIndex} className="border-b border-slate-300 last:border-b-0">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${
                    isToday ? 'bg-brand-50 text-brand-700' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {format(day, 'EEEE, MMM d')}
                  {isToday && (
                    <span className="normal-case font-medium text-brand-600">· Today</span>
                  )}
                </div>

                {visibleInterviewers.map((name, rowIndex) => {
                  const editable = canEdit(name);
                  const daySlots = slotsFor(name, day);
                  const isLastRow = rowIndex === visibleInterviewers.length - 1;
                  return (
                    <div
                      key={name}
                      className={`flex ${isLastRow ? '' : 'border-b border-slate-200'}`}
                    >
                      <div className="w-36 shrink-0 px-3 py-2 flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: colorFor(name) }}
                        />
                        <span className="text-xs font-medium text-slate-700 truncate" title={name}>
                          {name}
                        </span>
                      </div>
                      <div
                        data-track
                        className={`relative flex-1 h-11 ${editable ? 'cursor-crosshair' : ''}`}
                        style={{ touchAction: 'none' }}
                        onPointerDown={(e) => {
                          if (e.currentTarget === e.target) {
                            beginDrag('create', dayIndex, name, e);
                          }
                        }}
                        onPointerMove={onTrackPointerMove}
                        onPointerUp={onTrackPointerUp}
                        onPointerCancel={onTrackPointerUp}
                      >
                        {hourTicks.map((h) => (
                          <div
                            key={h}
                            className="absolute top-0 bottom-0 border-l border-slate-200"
                            style={{ left: `${((h - DAY_START) / HOURS) * 100}%` }}
                          />
                        ))}

                        {daySlots.map((s) => {
                          const isDragging = draft?.slotId === s.id;
                          const sH = isDragging ? draft!.startH : slotStartH(s);
                          const eH = isDragging ? draft!.endH : slotEndH(s);
                          return (
                            <SlotBlock
                              key={s.id}
                              startH={sH}
                              endH={eH}
                              color={colorFor(name)}
                              editable={editable}
                              onBodyDown={(e) => beginDrag('move', dayIndex, name, e, s)}
                              onLeftDown={(e) => beginDrag('resize-l', dayIndex, name, e, s)}
                              onRightDown={(e) => beginDrag('resize-r', dayIndex, name, e, s)}
                              onRemove={() => removeSlot(s.id)}
                            />
                          );
                        })}

                        {draft &&
                          draft.slotId === null &&
                          draft.dayIndex === dayIndex &&
                          sameName(draft.interviewerName, name) && (
                            <SlotBlock
                              startH={draft.startH}
                              endH={draft.endH}
                              color={colorFor(name)}
                              ghost
                              editable={false}
                            />
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SlotBlock({
  startH,
  endH,
  color,
  editable,
  ghost,
  onBodyDown,
  onLeftDown,
  onRightDown,
  onRemove,
}: {
  startH: number;
  endH: number;
  color: string;
  editable: boolean;
  ghost?: boolean;
  onBodyDown?: (e: React.PointerEvent) => void;
  onLeftDown?: (e: React.PointerEvent) => void;
  onRightDown?: (e: React.PointerEvent) => void;
  onRemove?: () => void;
}) {
  const left = ((startH - DAY_START) / HOURS) * 100;
  const width = ((endH - startH) / HOURS) * 100;
  return (
    <div
      className={`absolute top-1 bottom-1 rounded-md flex items-center justify-center text-[10px] font-semibold overflow-hidden ${
        editable ? 'cursor-move' : ''
      }`}
      style={{
        left: `${left}%`,
        width: `${Math.max(width, 0)}%`,
        background: ghost ? color + '55' : color,
        border: ghost ? `1px solid ${color}` : undefined,
        color: ghost ? color : '#fff',
        boxShadow: ghost ? undefined : '0 1px 2px rgb(0 0 0 / 0.08)',
      }}
      onPointerDown={editable ? onBodyDown : undefined}
    >
      {editable && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/10 hover:bg-black/25"
          onPointerDown={onLeftDown}
        />
      )}
      <span className="px-1.5 truncate pointer-events-none">
        {fmtHour(startH)} – {fmtHour(endH)}
      </span>
      {editable && !ghost && (
        <button
          className="absolute right-1 top-0.5 z-10 p-0.5 rounded hover:bg-black/20"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          aria-label="Remove slot"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {editable && (
        <span
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/10 hover:bg-black/25"
          onPointerDown={onRightDown}
        />
      )}
    </div>
  );
}
