import { useEffect, useState } from 'react';
import { api } from '../api.js';

const ROLES = ['admin', 'editor', 'viewer'];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [edit, setEdit] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({});
  const [notice, setNotice] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/admin/users')
      .then(d => setUsers(d.users))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(null), 3000); };

  const save = (e) => {
    e.preventDefault();
    const payload = edit
      ? { email: form.email, name: form.name, role: form.role, status: form.status }
      : { email: form.email, name: form.name, role: form.role, password: form.password };
    const action = edit ? api.put(`/admin/users/${edit.id}`, payload) : api.post('/admin/users', payload);
    action
      .then(() => { setEdit(null); setCreating(false); setForm({}); load(); flash('Salvo com sucesso'); })
      .catch(err => flash(err.message));
  };

  const resetLink = (u) => {
    api.post('/auth/reset-link', { user_id: u.id })
      .then(d => {
        const base = window.location.pathname.startsWith('/admin') ? '/admin' : '';
        flash(`Link de redefinição: ${window.location.origin}${base}${d.link}`);
      })
      .catch(err => flash(err.message));
  };

  const toggleBlock = (u) => {
    api.put(`/admin/users/${u.id}`, { email: u.email, name: u.name, role: u.role, status: u.status === 'active' ? 'blocked' : 'active' })
      .then(load)
      .catch(err => flash(err.message));
  };

  const remove = (u) => {
    if (!window.confirm(`Excluir o usuário ${u.email}? Esta ação não pode ser desfeita.`)) return;
    api.del(`/admin/users/${u.id}`).then(load).catch(err => flash(err.message));
  };

  const openEdit = (u) => { setEdit(u); setCreating(false); setForm({ ...u }); };
  const openCreate = () => { setCreating(true); setEdit(null); setForm({ email: '', name: '', role: 'viewer', password: '' }); };

  if (loading) return <div className="loading">Carregando usuários…</div>;
  if (error) return <div className="empty">{error}</div>;

  return (
    <>
      <div className="page-head"><h1>Usuários</h1><p>Dados de login editáveis — senhas nunca são exibidas, apenas redefinidas.</p></div>

      <div className="row end">
        {notice && <span className="muted grow">{notice}</span>}
        <button className="btn primary" onClick={openCreate}>+ Novo usuário</button>
      </div>

      {(edit || creating) && (
        <form className="panel" onSubmit={save}>
          <h3>{creating ? 'Criar usuário' : `Editar ${edit.email}`}</h3>
          <div className="form-grid">
            <div><label>Nome</label><input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>E-mail</label><input type="email" required value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><label>Papel</label>
              <select value={form.role || 'viewer'} onChange={e => setForm({ ...form, role: e.target.value })}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {creating ? (
              <div><label>Senha inicial (opcional — sem senha, envie convite)</label>
                <input value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="mínimo 8 caracteres" />
              </div>
            ) : (
              <div><label>Status</label>
                <select value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="active">ativo</option>
                  <option value="blocked">bloqueado</option>
                </select>
              </div>
            )}
          </div>
          <div className="row end" style={{ marginTop: 14 }}>
            <button type="button" className="btn" onClick={() => { setEdit(null); setCreating(false); }}>Cancelar</button>
            <button className="btn primary" type="submit">Salvar</button>
          </div>
        </form>
      )}

      <div className="panel scroll-x">
        <table>
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th><th>Cadastro</th><th>Último login</th><th>Provedor</th><th>Dispositivo/IP</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.name || '—'}</td>
                <td>{u.email}</td>
                <td><span className={`tag ${u.role === 'admin' ? 'blue' : u.role === 'editor' ? 'green' : 'gray'}`}>{u.role}</span></td>
                <td>{u.status === 'active' ? <span className="tag green">ativo</span> : <span className="tag red">bloqueado</span>}</td>
                <td className="muted">{u.created_at}</td>
                <td className="muted">{u.last_login_at || '—'}</td>
                <td className="muted">{u.provider}</td>
                <td className="muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.last_device || '—'}<br />{u.last_ip || ''}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn small" onClick={() => openEdit(u)}>Editar</button>
                    <button className="btn small" onClick={() => resetLink(u)}>Redefinir senha</button>
                    <button className="btn small" onClick={() => toggleBlock(u)}>{u.status === 'active' ? 'Bloquear' : 'Desbloquear'}</button>
                    <button className="btn small danger" onClick={() => remove(u)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
