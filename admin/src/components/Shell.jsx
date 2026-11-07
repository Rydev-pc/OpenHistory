import { Navigate, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { api, currentUser, clearSession, setUnauthorizedHandler } from '../api.js';

export function RequireAuth({ children }) {
  const [user, setUser] = useState(currentUser);
  const [checking, setChecking] = useState(!!currentUser());
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      navigate('/login', { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    api.get('/auth/me')
      .then(d => setUser(d.user))
      .catch(() => { clearSession(); setUser(null); })
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="loading">Verificando sessão…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Shell user={user}>{children}</Shell>;
}

export function Shell({ user, children }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState({ suggestions: 0, curiosities: 0 });
  const [toast, setToast] = useState(null);

  const refreshPending = useCallback(() => {
    api.get('/admin/metrics')
      .then(d => setPending({ suggestions: d.content.pendingSuggestions, curiosities: d.content.pendingCuriosities }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshPending();
    const es = new EventSource('/api/stream');
    const onAny = (e) => {
      refreshPending();
      if (e.type === 'support') flash('Novo apoio/mensagem de apoiador recebido');
      if (e.type === 'users') flash('Atividade de usuários atualizada');
    };
    ['support', 'users', 'audit', 'suggestions', 'facts', 'curiosities', 'settings'].forEach(t => es.addEventListener(t, onAny));
    return () => es.close();
  }, [refreshPending]);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {}).finally(() => {
      clearSession();
      navigate('/login', { replace: true });
    });
  };

  const links = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/usuarios', label: 'Usuários' },
    { to: '/fatos', label: 'Fatos' },
    { to: '/curiosidades', label: 'Curiosidades', count: pending.curiosities },
    { to: '/fontes', label: 'Fontes' },
    { to: '/apoio', label: 'Apoie o Criador' },
    { to: '/config', label: 'Configurações' },
    { to: '/feedback', label: 'Feedback', count: pending.suggestions },
    { to: '/auditoria', label: 'Auditoria' },
  ];

  const path = window.location.pathname;
  const roleLabel = { admin: 'Administrador', editor: 'Editor', viewer: 'Visualizador' }[user.role] || user.role;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Open<span>History</span> Admin</div>
        {links.map(l => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {l.label}
            {l.count > 0 && <span className="count">{l.count}</span>}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="who">
          <b>{user.name || user.email}</b>
          {roleLabel}
          <div style={{ marginTop: 10 }}>
            <button className="btn small" onClick={logout}>Sair</button>
          </div>
        </div>
      </aside>
      <main className="main">
        {children}
        {toast && <div className="toast">{toast}</div>}
      </main>
    </div>
  );
}
