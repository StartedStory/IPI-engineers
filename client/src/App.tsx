import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, Permissions, homePathFor, type Role } from './lib/auth';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import DevelopersPage from './pages/DevelopersPage';
import CalendarPage from './pages/CalendarPage';
import ProcessesPage from './pages/ProcessesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import TeammatesPage from './pages/TeammatesPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';

function AuthLoading() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="text-sm text-slate-500">Loading…</div>
    </div>
  );
}

function Protected({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow?: (r: Role) => boolean;
}) {
  const { user, bootstrapping } = useAuth();
  if (bootstrapping) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow(user.role)) return <Navigate to={homePathFor(user.role)} replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, bootstrapping } = useAuth();
  if (bootstrapping) {
    return (
      <Routes>
        <Route path="*" element={<AuthLoading />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={homePathFor(user.role)} replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route
          index
          element={
            <Protected allow={Permissions.dashboard.view}>
              <DashboardPage />
            </Protected>
          }
        />
        <Route
          path="developers"
          element={
            <Protected allow={Permissions.developers.view}>
              <DevelopersPage />
            </Protected>
          }
        />
        <Route
          path="calendar"
          element={
            <Protected allow={Permissions.calendar.view}>
              <CalendarPage />
            </Protected>
          }
        />
        <Route
          path="processes"
          element={
            <Protected allow={Permissions.processes.view}>
              <ProcessesPage />
            </Protected>
          }
        />
        <Route
          path="analytics"
          element={
            <Protected allow={Permissions.analytics.view}>
              <AnalyticsPage />
            </Protected>
          }
        />
        <Route
          path="teammates"
          element={
            <Protected allow={Permissions.teammates.view}>
              <TeammatesPage />
            </Protected>
          }
        />
        <Route
          path="users"
          element={
            <Protected allow={Permissions.users.view}>
              <UsersPage />
            </Protected>
          }
        />
        <Route
          path="*"
          element={<Navigate to={user ? homePathFor(user.role) : '/login'} replace />}
        />
      </Route>
    </Routes>
  );
}
