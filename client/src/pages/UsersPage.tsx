import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { Avatar } from '../components/Avatar';
import { api } from '../lib/api';
import { roleColor, useAuth, type Role } from '../lib/auth';
import type { AppUser } from '../lib/types';
import { Edit2, KeyRound, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const ROLES: Role[] = ['manager', 'bidder', 'interviewer', 'broker'];

type EditDraft = {
  id?: string;
  name: string;
  email: string;
  role: Role;
  password: string;
};

const EMPTY: EditDraft = { name: '', email: '', role: 'bidder', password: '' };

export default function UsersPage() {
  const { user: me } = useAuth();
  const [list, setList] = useState<AppUser[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Role | 'all'>('all');
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const r = await api.get<AppUser[]>('/users');
    setList(r.data);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = list.filter((u) => {
    if (filter !== 'all' && u.role !== filter) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  const counts: Record<Role | 'all', number> = {
    all: list.length,
    manager: list.filter((u) => u.role === 'manager').length,
    bidder: list.filter((u) => u.role === 'bidder').length,
    interviewer: list.filter((u) => u.role === 'interviewer').length,
    broker: list.filter((u) => u.role === 'broker').length,
  };

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: editing.name,
        email: editing.email,
        role: editing.role,
      };
      if (editing.password) body.password = editing.password;
      if (editing.id) {
        await api.put(`/users/${editing.id}`, body);
      } else {
        await api.post('/users', body);
      }
      setEditing(null);
      load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Failed to save user');
    } finally {
      setBusy(false);
    }
  }

  async function remove(u: AppUser) {
    if (u.id === me?.id) return;
    if (!confirm(`Delete ${u.name} (${u.email})? They will lose access immediately.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  }

  return (
    <div>
      <PageHeader
        title="Users & Access"
        subtitle="Manager-only. Create login accounts and reset passwords. Roles control everything in the app."
        actions={
          <button className="btn-primary" onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="h-4 w-4" /> New user
          </button>
        }
      />

      <div className="card">
        <div className="p-3 border-b border-slate-200 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search by name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap ml-auto">
            <button
              onClick={() => setFilter('all')}
              className={`pill border ${
                filter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              All ({counts.all})
            </button>
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setFilter(r)}
                className={`pill border ${
                  filter === r ? `${roleColor[r]} ring-2 ring-slate-300` : roleColor[r]
                }`}
              >
                {r} ({counts[r]})
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-200 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Role</th>
                <th className="text-left px-4 py-2.5">Created</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-200/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.name} src={u.avatarUrl} size={28} />
                        <div>
                          <div className="font-semibold text-slate-900">{u.name}</div>
                          {isSelf && (
                            <div className="text-[11px] text-slate-400">you</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`badge border ${roleColor[u.role]}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() =>
                            setEditing({
                              id: u.id,
                              name: u.name,
                              email: u.email,
                              role: u.role,
                              password: '',
                            })
                          }
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(u)}
                          disabled={isSelf}
                          className="p-1.5 rounded hover:bg-rose-50 text-rose-500 disabled:opacity-30 disabled:hover:bg-transparent"
                          title={isSelf ? 'You cannot delete yourself' : 'Delete'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No users match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 card p-4 flex items-start gap-3">
        <div className="h-8 w-8 rounded-md bg-brand-50 text-brand-600 grid place-items-center shrink-0">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="text-sm text-slate-600">
          <strong className="text-slate-900">Heads-up:</strong> Users (login accounts) and{' '}
          <strong>Teammates</strong> (directory entries shown to bidders/interviewers and used in
          interviewer dropdowns) are tracked separately. When you add an interviewer or broker
          here, also add a matching{' '}
          <a className="text-brand-600 hover:underline" href="/teammates">
            Teammate
          </a>{' '}
          with the same name so role-based filtering works (e.g. interviewers only see their own
          events).
        </div>
      </div>

      <Modal
        open={!!editing}
        onClose={() => {
          if (!busy) {
            setEditing(null);
            setError(null);
          }
        }}
        title={editing?.id ? 'Edit user' : 'New user'}
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Display name *</label>
                <input
                  className="input"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  className="input"
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Role *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setEditing({ ...editing, role: r })}
                    className={`px-3 py-2 rounded-md border text-sm font-medium capitalize ${
                      editing.role === r
                        ? `${roleColor[r]} ring-2 ring-slate-300`
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    } ${
                      editing.id === me?.id && r !== 'manager' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={editing.id === me?.id && r !== 'manager'}
                    title={
                      editing.id === me?.id && r !== 'manager'
                        ? 'You cannot demote yourself'
                        : undefined
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-1">
                <KeyRound className="h-3 w-3" />
                {editing.id ? 'New password (leave blank to keep current)' : 'Password *'}
              </label>
              <input
                type="password"
                className="input font-mono"
                value={editing.password}
                onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                placeholder={editing.id ? '••••••••' : 'min. 6 characters'}
                autoComplete="new-password"
              />
            </div>
            {error && (
              <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="btn-secondary"
                onClick={() => {
                  setEditing(null);
                  setError(null);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={save}
                disabled={
                  busy ||
                  !editing.name ||
                  !editing.email ||
                  (!editing.id && (!editing.password || editing.password.length < 6))
                }
              >
                {busy ? 'Saving…' : editing.id ? 'Save changes' : 'Create user'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
