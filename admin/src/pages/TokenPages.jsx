import { useState } from 'react';
import { api } from '../api.js';

export function ResetPassword() {
  const [form, setForm] = useState({ token: new URLSearchParams(window.location.search).get('token') || '', password: '' });
  const [result, setResult] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    setResult(null);
    api.post('/auth/reset-password', form)
      .then(() => setResult({ ok: true, msg: 'Senha redefinida! Faça login no painel.' }))
      .catch(err => setResult({ ok: false, msg: err.message }));
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Redefinir senha</h1>
        <p className="sub">Link enviado por um administrador. Válido por 1 hora.</p>
        <label htmlFor="token">Token</label>
        <input id="token" value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} />
        <label htmlFor="np">Nova senha (8+ caracteres)</label>
        <input id="np" type="password" required minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        {result && <p className={result.ok ? 'ok-text' : 'error-text'} style={{ marginTop: 12 }}>{result.msg}</p>}
        <div style={{ marginTop: 16 }}><button className="btn primary block">Redefinir</button></div>
        <p className="muted" style={{ marginTop: 12, textAlign: 'center' }}><a href="/">Voltar ao login</a></p>
      </form>
    </div>
  );
}

export function AcceptInvite() {
  const [form, setForm] = useState({ token: new URLSearchParams(window.location.search).get('token') || '', name: '', password: '' });
  const [result, setResult] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    setResult(null);
    api.post('/auth/complete-invite', form)
      .then(() => setResult({ ok: true, msg: 'Conta ativada! Faça login no painel.' }))
      .catch(err => setResult({ ok: false, msg: err.message }));
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Aceitar convite</h1>
        <p className="sub">Você foi convidado para a equipe do Open History.</p>
        <label htmlFor="it">Token do convite</label>
        <input id="it" value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} />
        <label htmlFor="nm">Nome</label>
        <input id="nm" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <label htmlFor="ps">Senha (8+ caracteres)</label>
        <input id="ps" type="password" required minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        {result && <p className={result.ok ? 'ok-text' : 'error-text'} style={{ marginTop: 12 }}>{result.msg}</p>}
        <div style={{ marginTop: 16 }}><button className="btn primary block">Ativar conta</button></div>
      </form>
    </div>
  );
}
