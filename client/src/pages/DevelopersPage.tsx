import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { api } from '../lib/api';
import { useAuth, Permissions } from '../lib/auth';
import type { Developer } from '../lib/types';
import { Download, Edit2, FileText, Linkedin, Plus, Search, Trash2, Upload } from 'lucide-react';

export default function DevelopersPage() {
  const { user } = useAuth();
  const canEdit = !!user && Permissions.developers.edit(user.role);
  const [devs, setDevs] = useState<Developer[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Partial<Developer> | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [removeCv, setRemoveCv] = useState(false);
  const [busy, setBusy] = useState(false);

  async function downloadCv(d: Developer) {
    if (!d.cvFile) return;
    try {
      const res = await api.get(`/developers/${d.id}/cv`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = d.cvFile.originalName || 'cv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Could not download CV.');
    }
  }

  async function load() {
    const r = await api.get<Developer[]>('/developers');
    setDevs(r.data);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = devs.filter((d) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [d.name, d.location, d.email, d.linkedin].some((v) =>
      (v || '').toLowerCase().includes(s)
    );
  });

  function openNew() {
    setEditing({ name: '', location: '', email: '', password: '', linkedin: '' });
    setCvFile(null);
    setRemoveCv(false);
  }
  function openEdit(d: Developer) {
    setEditing({ ...d });
    setCvFile(null);
    setRemoveCv(false);
  }
  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const form = new FormData();
      ['name', 'location', 'email', 'password', 'linkedin'].forEach((k) => {
        form.append(k, (editing as any)[k] ?? '');
      });
      if (cvFile) form.append('cv', cvFile);
      if (removeCv) form.append('removeCv', 'true');
      if (editing.id) {
        await api.put(`/developers/${editing.id}`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/developers', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setEditing(null);
      load();
    } finally {
      setBusy(false);
    }
  }
  async function remove(d: Developer) {
    if (!confirm(`Delete ${d.name}?`)) return;
    await api.delete(`/developers/${d.id}`);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Developer profiles"
        subtitle="The pool of candidates managed by the bidding team."
        actions={
          canEdit && (
            <button className="btn-primary" onClick={openNew}>
              <Plus className="h-4 w-4" /> New developer
            </button>
          )
        }
      />
      <div className="card">
        <div className="p-3 border-b border-slate-200 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search by name, location, email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="text-xs text-slate-500 ml-auto">{filtered.length} developers</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Location</th>
                <th className="text-left px-4 py-2.5">Email / password</th>
                <th className="text-left px-4 py-2.5">LinkedIn</th>
                <th className="text-left px-4 py-2.5">CV</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{d.name}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{d.location || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900">{d.email || '—'}</div>
                    <div className="text-xs text-slate-400 font-mono">{d.password || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    {d.linkedin ? (
                      <a
                        href={d.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                      >
                        <Linkedin className="h-4 w-4" /> profile
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {d.cvFile ? (
                      <button
                        type="button"
                        onClick={() => downloadCv(d)}
                        className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                        <span className="truncate max-w-[120px]">{d.cvFile.originalName}</span>
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(d)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(d)}
                          className="p-1.5 rounded hover:bg-rose-50 text-rose-500"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No developers yet.
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
        title={editing?.id ? 'Edit developer' : 'New developer'}
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Name *</label>
                <input
                  className="input"
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Location</label>
                <input
                  className="input"
                  value={editing.location || ''}
                  onChange={(e) => setEditing({ ...editing, location: e.target.value })}
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
                <label className="label">Password</label>
                <input
                  className="input font-mono"
                  value={editing.password || ''}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">LinkedIn URL</label>
              <input
                className="input"
                value={editing.linkedin || ''}
                onChange={(e) => setEditing({ ...editing, linkedin: e.target.value })}
                placeholder="https://www.linkedin.com/in/…"
              />
            </div>
            <div>
              <label className="label">CV (PDF/DOC, max 10MB)</label>
              <label className="btn-secondary w-full justify-center cursor-pointer">
                <Upload className="h-4 w-4" />
                {cvFile ? cvFile.name : 'Choose file'}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {editing.id && editing.cvFile && !removeCv && (
                <label className="mt-2 text-xs text-rose-600 inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={removeCv}
                    onChange={(e) => setRemoveCv(e.target.checked)}
                  />
                  Remove current CV ({editing.cvFile.originalName})
                </label>
              )}
            </div>
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
