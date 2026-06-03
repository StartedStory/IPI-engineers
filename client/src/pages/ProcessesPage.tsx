import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { api } from '../lib/api';
import { useAuth, Permissions } from '../lib/auth';
import {
  STAGES,
  STAGE_BG,
  type Developer,
  type ProcessItem,
  type Stage,
  type Teammate,
} from '../lib/types';
import { Edit2, ExternalLink, Plus, Trash2 } from 'lucide-react';

export default function ProcessesPage() {
  const { user } = useAuth();
  const canEdit = !!user && Permissions.processes.edit(user.role);
  const canDelete = user?.role === 'manager';
  const [items, setItems] = useState<ProcessItem[]>([]);
  const [devs, setDevs] = useState<Developer[]>([]);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [editing, setEditing] = useState<Partial<ProcessItem> | null>(null);
  const [filterStage, setFilterStage] = useState<Stage | 'all'>('all');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await api.get<ProcessItem[]>('/processes');
    setItems(r.data);
  }

  async function loadWithSync() {
    if (user && Permissions.processes.edit(user.role)) {
      try {
        await api.post('/processes/sync-from-events');
      } catch {
        /* still load processes if sync fails */
      }
    }
    await load();
  }

  useEffect(() => {
    loadWithSync();
    if (user && Permissions.developers.view(user.role)) {
      api.get<Developer[]>('/developers').then((r) => setDevs(r.data)).catch(() => {});
    }
    if (user && Permissions.teammates.view(user.role)) {
      api.get<Teammate[]>('/teammates').then((r) => setTeammates(r.data)).catch(() => {});
    }
  }, [user]);

  const interviewers = teammates.filter((t) => t.role === 'interviewer');

  const filtered =
    filterStage === 'all' ? items : items.filter((i) => i.stage === filterStage);

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      if (editing.id) {
        await api.put(`/processes/${editing.id}`, editing);
      } else {
        await api.post('/processes', editing);
      }
      setEditing(null);
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function remove(p: ProcessItem) {
    if (!confirm(`Delete process for ${p.companyName}?`)) return;
    await api.delete(`/processes/${p.id}`);
    await load();
  }

  function openNew() {
    setEditing({
      companyName: '',
      roleTitle: '',
      developerName: '',
      stage: 'intro',
      interviewerName: '',
      brokerName: '',
      jdLink: '',
      notes: '',
    });
  }

  return (
    <div>
      <PageHeader
        title="Interview processes"
        subtitle={
          user?.role === 'broker'
            ? 'Showing only processes where you are the assigned broker.'
            : 'Pipelines sync from the calendar (company + role + developer). Add a broker on each row for broker visibility.'
        }
        actions={
          canEdit && (
            <button className="btn-primary" onClick={openNew}>
              <Plus className="h-4 w-4" /> New process
            </button>
          )
        }
      />

      <div className="card">
        <div className="p-3 border-b border-slate-200 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterStage('all')}
            className={`pill border ${
              filterStage === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            All ({items.length})
          </button>
          {STAGES.map((s) => {
            const count = items.filter((i) => i.stage === s).length;
            return (
              <button
                key={s}
                onClick={() => setFilterStage(s)}
                className={`pill border ${
                  filterStage === s
                    ? `${STAGE_BG[s]} ring-2 ring-slate-300`
                    : `${STAGE_BG[s]}`
                }`}
              >
                {s} ({count})
              </button>
            );
          })}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Company / Role</th>
                <th className="text-left px-4 py-2.5">Developer</th>
                <th className="text-left px-4 py-2.5">Stage</th>
                <th className="text-left px-4 py-2.5">Interviewer</th>
                <th className="text-left px-4 py-2.5">Broker</th>
                <th className="text-left px-4 py-2.5">JD</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{p.companyName}</div>
                    <div className="text-xs text-slate-500">{p.roleTitle}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{p.developerName || '—'}</td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <select
                        className="input py-1 text-xs"
                        value={p.stage}
                        onChange={async (e) => {
                          await api.put(`/processes/${p.id}`, { stage: e.target.value });
                          load();
                        }}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`badge border ${STAGE_BG[p.stage]}`}>{p.stage}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{p.interviewerName || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{p.brokerName || '—'}</td>
                  <td className="px-4 py-3">
                    {p.jdLink ? (
                      <a
                        href={p.jdLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                      >
                        Open <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <button
                          onClick={() => setEditing({ ...p })}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => remove(p)}
                          className="p-1.5 rounded hover:bg-rose-50 text-rose-500"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No processes yet. Calendar events with a company and role title appear here
                    automatically (open this page as manager/bidder to sync existing events).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit process' : 'New process'}
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Company *</label>
                <input
                  className="input"
                  value={editing.companyName || ''}
                  onChange={(e) => setEditing({ ...editing, companyName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Role title *</label>
                <input
                  className="input"
                  value={editing.roleTitle || ''}
                  onChange={(e) => setEditing({ ...editing, roleTitle: e.target.value })}
                />
              </div>
            </div>
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
                    <option value="">—</option>
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
                <label className="label">Stage</label>
                <select
                  className="input"
                  value={editing.stage || 'intro'}
                  onChange={(e) => setEditing({ ...editing, stage: e.target.value as Stage })}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
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
                  />
                )}
              </div>
              <div>
                <label className="label">Broker</label>
                <input
                  className="input"
                  value={editing.brokerName || ''}
                  onChange={(e) => setEditing({ ...editing, brokerName: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Job description link</label>
              <input
                className="input"
                value={editing.jdLink || ''}
                onChange={(e) => setEditing({ ...editing, jdLink: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                className="input min-h-[80px]"
                value={editing.notes || ''}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={save}
                disabled={busy || !editing.companyName || !editing.roleTitle}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
