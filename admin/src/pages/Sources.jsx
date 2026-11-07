import { useEffect, useState } from 'react';
import { api } from '../api.js';

const TYPES = { enciclopedia: 'Enciclopédia', acervo: 'Acervo digital', livro: 'Livro', artigo: 'Artigo', outro: 'Outro' };
const EMPTY = { name: '', url: '', type: 'enciclopedia', description: '', active: true };

export default function Sources() {
  const [sources, setSources] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/admin/sources').then(d => setSources(d.sources)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(null), 3000); };

  const save = (e) => {
    e.preventDefault();
    const payload = { ...form };
    delete payload._open;
    const action = edit ? api.put(`/admin/sources/${edit.id}`, payload) : api.post('/admin/sources', payload);
    action.then(() => { setEdit(null); setForm(EMPTY); load(); flash('Fonte salva'); }).catch(err => flash(err.message));
  };

  const remove = (s) => {
    if (!window.confirm(`Excluir a fonte "${s.name}"?`)) return;
    api.del(`/admin/sources/${s.id}`).then(load).catch(err => flash(err.message));
  };

  if (loading) return <div className="loading">Carregando fontes…</div>;

  return (
    <>
      <div className="page-head"><h1>Fontes confiáveis</h1><p>Cadastro de acervos e referências usadas nas citações do app.</p></div>

      <div className="row end">{notice && <span className="muted grow">{notice}</span>}<button className="btn primary" onClick={() => { setEdit(null); setForm({ ...EMPTY, _open: 1 }); }}>+ Nova fonte</button></div>

      {form._open && (
        <form className="panel" onSubmit={save}>
          <h3>{edit ? `Editar: ${edit.name}` : 'Nova fonte'}</h3>
          <div className="form-grid">
            <div><label>Nome</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>URL</label><input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></div>
            <div><label>Tipo</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label>Ativa</label>
              <select value={form.active ? 'sim' : 'nao'} onChange={e => setForm({ ...form, active: e.target.value === 'sim' })}>
                <option value="sim">sim</option>
                <option value="nao">não</option>
              </select>
            </div>
            <div className="full"><label>Descrição</label><textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="row end" style={{ marginTop: 14 }}>
            <button type="button" className="btn" onClick={() => { setForm(EMPTY); setEdit(null); }}>Cancelar</button>
            <button className="btn primary" type="submit">Salvar</button>
          </div>
        </form>
      )}

      <div className="panel scroll-x">
        <table>
          <thead><tr><th>Nome</th><th>Tipo</th><th>URL</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="muted">{TYPES[s.type] || s.type}</td>
                <td className="muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.url || '—'}</td>
                <td>{s.active ? <span className="tag green">ativa</span> : <span className="tag gray">inativa</span>}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn small" onClick={() => { setEdit(s); setForm({ ...s, active: !!s.active, _open: 1 }); }}>Editar</button>
                    <button className="btn small danger" onClick={() => remove(s)}>Excluir</button>
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
