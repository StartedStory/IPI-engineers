import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, Permissions, roleColor } from '../lib/auth';
import {
  CalendarDays,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  ShieldCheck,
  Users,
  UserSquare2,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, allow: Permissions.dashboard.view },
  { to: '/developers', label: 'Developers', icon: UserSquare2, allow: Permissions.developers.view },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, allow: Permissions.calendar.view },
  { to: '/processes', label: 'Interview Processes', icon: ListChecks, allow: Permissions.processes.view },
  { to: '/analytics', label: 'Analytics', icon: LineChart, allow: Permissions.analytics.view },
  { to: '/teammates', label: 'Teammates', icon: Users, allow: Permissions.teammates.view },
  { to: '/users', label: 'Users & Access', icon: ShieldCheck, allow: Permissions.users.view },
];

export function Layout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  if (!user) return null;
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-brand-500 grid place-items-center text-white font-bold">
              IPI
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Interview Proxy Iran</div>
              <div className="text-[11px] text-slate-500">Interview · Process · Insights</div>
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
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </NavLink>
              );
            })}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-200 grid place-items-center text-slate-700 font-semibold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{user.name}</div>
              <span className={`badge border ${roleColor[user.role]}`}>{user.role}</span>
            </div>
            <button
              onClick={logout}
              title="Log out"
              className="p-2 rounded-md hover:bg-slate-100 text-slate-500"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
