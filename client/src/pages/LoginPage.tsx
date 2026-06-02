import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-brand-500 via-brand-600 to-brand-900 text-white p-12">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-white/10 backdrop-blur grid place-items-center font-bold">
              IPI
            </div>
            <span className="font-semibold">Interview Proxy Iran</span>
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">
            Plan interviews. Track pipelines. Measure outcomes.
          </h1>
          <p className="mt-4 text-brand-100/90 max-w-md">
            A single workspace for managers, bidders, interviewers and brokers — with role-based
            access, a shared schedule, and live analytics.
          </p>
        </div>
        <div className="text-sm text-brand-100/80">
          © {new Date().getFullYear()} Interview Proxy Iran
        </div>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold mb-1">Sign in</h2>
          <p className="text-sm text-slate-500 mb-6">
            Sign in with the account provided by your manager.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">
                {error}
              </div>
            )}
            <button className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
