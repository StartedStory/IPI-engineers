import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';

export type Role = 'manager' | 'bidder' | 'interviewer' | 'broker';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type AuthContextValue = {
  user: User | null;
  bootstrapping: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);

  const clearSession = useCallback(() => {
    localStorage.removeItem('ipi_token');
    localStorage.removeItem('ipi_user');
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('ipi_token');
    if (!token) {
      setBootstrapping(false);
      return;
    }
    api
      .get('/auth/me')
      .then((r) => {
        setUser(r.data.user);
        localStorage.setItem('ipi_user', JSON.stringify(r.data.user));
      })
      .catch(() => clearSession())
      .finally(() => setBootstrapping(false));
  }, [clearSession]);

  useEffect(() => {
    const onLogout = () => clearSession();
    window.addEventListener('ipi:logout', onLogout);
    return () => window.removeEventListener('ipi:logout', onLogout);
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('ipi_token', data.token);
      localStorage.setItem('ipi_user', JSON.stringify(data.user));
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, bootstrapping, loading, login, logout }),
    [user, bootstrapping, loading, login, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export const Permissions = {
  dashboard: {
    view: (r: Role) => r !== 'broker',
  },
  developers: {
    view: (r: Role) => r !== 'broker',
    edit: (r: Role) => r === 'manager' || r === 'bidder',
  },
  calendar: {
    view: (r: Role) => r !== 'broker',
    edit: (r: Role) => r === 'manager' || r === 'bidder',
    markDone: (r: Role) => r === 'manager' || r === 'interviewer' || r === 'bidder',
  },
  processes: {
    view: (_r: Role) => true,
    edit: (r: Role) => r === 'manager' || r === 'bidder',
  },
  analytics: {
    view: (r: Role) => r === 'manager' || r === 'bidder' || r === 'interviewer',
  },
  teammates: {
    view: (r: Role) => r !== 'broker',
    viewContacts: (r: Role) => r === 'manager',
    edit: (r: Role) => r === 'manager',
  },
  users: {
    view: (r: Role) => r === 'manager',
    edit: (r: Role) => r === 'manager',
  },
} as const;

export function homePathFor(role: Role): string {
  return role === 'broker' ? '/processes' : '/';
}

export const roleColor: Record<Role, string> = {
  manager: 'bg-violet-100 text-violet-700 border-violet-200',
  bidder: 'bg-sky-100 text-sky-700 border-sky-200',
  interviewer: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  broker: 'bg-amber-100 text-amber-700 border-amber-200',
};
