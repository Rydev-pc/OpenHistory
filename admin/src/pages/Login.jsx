import { useState } from 'react';
import { api, setSession } from '../api.js';

export default function Login() {
  const [email, setEmail] = useState('admin@openhistory.app');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    api.post('/auth/login', { email, password })
      .then(d => {
        setSession(d.token, d.user);
        window.location.href = '/';
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Open History <span className="tag blue" style={{ marginLeft: 6 }}>Painel</span></h1>
        <p className="sub">Acesso restrito à equipe. Sessões são registradas em auditoria.</p>
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
        {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
        <div style={{ marginTop: 18 }}>
          <button className="btn primary block" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
        </div>
      </form>
    </div>
  );
}
