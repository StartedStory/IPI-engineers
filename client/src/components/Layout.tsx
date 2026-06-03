import { useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, Permissions, roleColor } from '../lib/auth';
import { api } from '../lib/api';
import { fileToAvatarDataUrl } from '../lib/image';
import { Avatar } from './Avatar';
import { Modal } from './Modal';
import {
  CalendarClock,
  CalendarDays,
  Camera,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  ShieldCheck,
  Trash2,
  Users,
  UserSquare2,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, allow: Permissions.dashboard.view },
  { to: '/developers', label: 'Developers', icon: UserSquare2, allow: Permissions.developers.view },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, allow: Permissions.calendar.view },
  { to: '/availability', label: 'Availability', icon: CalendarClock, allow: Permissions.availability.view },
  { to: '/processes', label: 'Interview Processes', icon: ListChecks, allow: Permissions.processes.view },
  { to: '/analytics', label: 'Analytics', icon: LineChart, allow: Permissions.analytics.view },
  { to: '/teammates', label: 'Teammates', icon: Users, allow: Permissions.teammates.view },
  { to: '/users', label: 'Users & Access', icon: ShieldCheck, allow: Permissions.users.view },
];

export function Layout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  if (!user) return null;
  return (
    <div className="min-h-screen flex bg-slate-200">
      <aside className="w-64 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-brand-500 grid place-items-center text-white font-bold">
              IPI
            </div>
            <div>
              <div className="text-sm font-bold text-white">Interview Proxy Iran</div>
              <div className="text-[11px] text-slate-400">Interview · Process · Insights</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems
            .filter((n) => n.allow(user.role))
            .map((n) => {
              const Icon = n.icon;
              const active = loc.pathname === n.to;
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive || active
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </NavLink>
              );
            })}
        </nav>
        <div className="border-t border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setProfileOpen(true)}
              title="Change profile photo"
              className="relative group rounded-full"
            >
              <Avatar name={user.name} src={user.avatarUrl} size={36} />
              <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 grid place-items-center transition-opacity">
                <Camera className="h-4 w-4 text-white" />
              </span>
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user.name}</div>
              <span className={`badge border ${roleColor[user.role]}`}>{user.role}</span>
            </div>
            <button
              onClick={logout}
              title="Log out"
              className="p-2 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      const { data } = await api.put('/auth/me/avatar', { avatarUrl: dataUrl });
      updateUser({ avatarUrl: data.user.avatarUrl });
    } catch (err) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2.response?.data?.error || 'Could not update your photo.');
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.put('/auth/me/avatar', { avatarUrl: '' });
      updateUser({ avatarUrl: data.user.avatarUrl });
    } catch (err) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2.response?.data?.error || 'Could not remove your photo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Profile photo" size="sm">
      <div className="flex flex-col items-center gap-4">
        <Avatar name={user.name} src={user.avatarUrl} size={96} />
        <div className="text-center">
          <div className="font-semibold text-slate-900">{user.name}</div>
          <div className="text-sm text-slate-500">{user.email}</div>
        </div>
        {error && (
          <div className="w-full rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">
            {error}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
        <div className="flex items-center gap-2">
          <button
            className="btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Camera className="h-4 w-4" />
            {busy ? 'Saving…' : user.avatarUrl ? 'Change photo' : 'Upload photo'}
          </button>
          {user.avatarUrl && (
            <button className="btn-secondary" onClick={removePhoto} disabled={busy}>
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400 text-center">
          Images are cropped to a square and resized automatically.
        </p>
      </div>
    </Modal>
  );
}
