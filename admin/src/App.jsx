import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { RequireAuth } from './components/Shell.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Users from './pages/Users.jsx';
import Facts from './pages/Facts.jsx';
import Curiosities from './pages/Curiosities.jsx';
import Sources from './pages/Sources.jsx';
import SupportAdmin from './pages/SupportAdmin.jsx';
import SettingsAd from './pages/SettingsAd.jsx';
import Feedback from './pages/Feedback.jsx';
import Audit from './pages/Audit.jsx';
import { ResetPassword, AcceptInvite } from './pages/TokenPages.jsx';
import { currentUser } from './api.js';

function AdminOnly({ children }) {
  if (currentUser() && currentUser().role !== 'admin') {
    return (
      <div className="panel" style={{ borderColor: '#fecaca' }}>
        <h3 style={{ color: '#b91c1c' }}>Acesso restrito</h3>
        <p className="muted">Esta área é exclusiva para administradores.</p>
      </div>
    );
  }
  return children;
}

export default function App() {
  const location = useLocation();
  const base = window.location.pathname.startsWith('/admin') ? '/admin' : '';

  if (location.pathname === base + '/resetar-senha') return <ResetPassword />;
  if (location.pathname === base + '/aceitar-convite') return <AcceptInvite />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/resetar-senha" element={<ResetPassword />} />
      <Route path="/aceitar-convite" element={<AcceptInvite />} />
      <Route
        path="*"
        element={
          <RequireAuth>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/usuarios" element={<AdminOnly><Users /></AdminOnly>} />
              <Route path="/fatos" element={<Facts />} />
              <Route path="/curiosidades" element={<Curiosities />} />
              <Route path="/fontes" element={<Sources />} />
              <Route path="/apoio" element={<SupportAdmin />} />
              <Route path="/config" element={<SettingsAd />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/auditoria" element={<AdminOnly><Audit /></AdminOnly>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
