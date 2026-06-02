import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { api } from '../lib/api';
import { useAuth, Permissions, roleColor, type Role } from '../lib/auth';
import type { Teammate } from '../lib/types';
import { Edit2, Mail, MessageCircle, Plus, Send, Trash2 } from 'lucide-react';

const ROLES: Teammate['role'][] = ['bidder', 'interviewer', 'broker'];

export default function TeammatesPage() {
  const { user } = useAuth();
  const canEdit = !!user && Permissions.teammates.edit(user.role);
  const canSeeContacts = !!user && Permissions.teammates.viewContacts(user.role);
  const [list, setList] = useState<Teammate[]>([]);
  const [editing, setEditing] = useState<Partial<Teammate> | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await api.get<Teammate[]>('/teammates');
    setList(r.data);
  }
  useEffect(() => {
    load();
  }, []);

  const grouped: Record<Teammate['role'], Teammate[]> = {
    bidder: [],
    interviewer: [],
    broker: [],
  };
  for (const t of list) grouped[t.role]?.push(t);

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      if (editing.id) {
        await api.put(`/teammates/${editing.id}`, editing);
      } else {
        await api.post('/teammates', editing);
      }
      setEditing(null);
      load();
    } finally {
      setBusy(false);
    }
  }
  async function remove(t: Teammate) {
    if (!confirm(`Remove ${t.name}?`)) return;
    await api.delete(`/teammates/${t.id}`);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Teammates"
        subtitle={
          canSeeContacts
            ? 'Bidders, interviewers and brokers — with their contact channels.'
            : 'Bidders, interviewers and brokers. Contact channels are visible to managers only.'
        }
        actions={
          canEdit && (
            <button
              className="btn-primary"
              onClick={() =>
                setEditing({
                  role: 'bidder',
                  name: '',
                  email: '',
                  telegram: '',
                  discord: '',
                  whatsapp: '',
                })
              }
            >
              <Plus className="h-4 w-4" /> New teammate
            </button>
          )
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        {ROLES.map((role) => (
          <div key={role} className="card">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold capitalize">{role}s</h3>
                <p className="text-xs text-slate-500">{grouped[role].length} member(s)</p>
              </div>
              <span className={`badge border ${roleColor[role as Role]}`}>{role}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {grouped[role].map((t) => (
                <li key={t.id} className="p-4 flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-slate-100 grid place-items-center text-slate-600 font-semibold">
                    {t.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{t.name}</div>
                    {canSeeContacts ? (
                      <>
                        {t.email && (
                          <div className="text-xs text-slate-500 inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <a href={`mailto:${t.email}`} className="hover:underline truncate">
                              {t.email}
                            </a>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {t.telegram && (
                            <ContactChip icon={<Send className="h-3 w-3" />} label={t.telegram} />
                          )}
                          {t.discord && (
                            <ContactChip
                              icon={<MessageCircle className="h-3 w-3" />}
                              label={t.discord}
                            />
                          )}
                          {t.whatsapp && (
                            <ContactChip
                              icon={<MessageCircle className="h-3 w-3" />}
                              label={t.whatsapp}
                            />
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="h-11 mt-1" aria-hidden />
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setEditing({ ...t })}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(t)}
                        className="p-1.5 rounded hover:bg-rose-50 text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {grouped[role].length === 0 && (
                <li className="p-6 text-sm text-slate-400 text-center">No {role}s yet.</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit teammate' : 'New teammate'}
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Role</label>
                <select
                  className="input"
                  value={editing.role || 'bidder'}
                  onChange={(e) =>
                    setEditing({ ...editing, role: e.target.value as Teammate['role'] })
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Name *</label>
                <input
                  className="input"
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Email (gmail)</label>
                <input
                  className="input"
                  value={editing.email || ''}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Telegram</label>
                <input
                  className="input"
                  value={editing.telegram || ''}
                  onChange={(e) => setEditing({ ...editing, telegram: e.target.value })}
                  placeholder="@handle"
                />
              </div>
            </div>
            {editing.role !== 'bidder' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Discord</label>
                  <input
                    className="input"
                    value={editing.discord || ''}
                    onChange={(e) => setEditing({ ...editing, discord: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input
                    className="input"
                    value={editing.whatsapp || ''}
                    onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={save} disabled={busy || !editing.name}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ContactChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-700">
      {icon}
      {label}
    </span>
  );
}
