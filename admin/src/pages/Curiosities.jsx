import { useEffect, useState } from 'react';
import { api } from '../api.js';

const EMPTY = { title: 'Você sabia?', text: '', source_name: '', source_url: '', status: 'published' };

export default function Curiosities() {
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/admin/curiosities').then(d => setItems(d.items)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(null), 3000); };

  const save = (e) => {
    e.preventDefault();
    const payload = { ...form };
    delete payload._open;
    const action = edit ? api.put(`/admin/curiosities/${edit.id}`, payload) : api.post('/admin/curiosities', payload);
    action
      .then(() => { setEdit(null); setForm(EMPTY); load(); flash('Curiosidade salva'); })
      .catch(err => flash(err.message));
  };

  const remove = (c) => {
    if (!window.confirm(`Excluir "${c.title}"?`)) return;
    api.del(`/admin/curiosities/${c.id}`).then(load).catch(err => flash(err.message));
  };

  const setStatus = (c, status) => api.put(`/admin/curiosities/${c.id}`, { ...c, status }).then(load).catch(err => flash(err.message));

  if (loading) return <div className="loading">Carregando curiosidades…</div>;

  return (
    <>
      <div className="page-head"><h1>Curiosidades</h1><p>Curadoria "Você sabia?" — itens pendentes aguardam moderação.</p></div>

      <div className="row end">{notice && <span className="muted grow">{notice}</span>}<button className="btn primary" onClick={() => { setEdit(null); setForm({ ...EMPTY, _open: 1 }); }}>+ Nova curiosidade</button></div>

      {form._open && (
        <form className="panel" onSubmit={save}>
          <h3>{edit ? 'Editar curiosidade' : 'Nova curiosidade'}</h3>
          <div className="form-grid">
            <div className="full"><label>Texto</label><textarea rows={3} required value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} /></div>
            <div><label>Fonte (nome)</label><input value={form.source_name} onChange={e => setForm({ ...form, source_name: e.target.value })} /></div>
            <div><label>Fonte (URL)</label><input value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} /></div>
            <div><label>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="published">publicada</option>
                <option value="pending">pendente</option>
                <option value="draft">rascunho</option>
              </select>
            </div>
          </div>
          <div className="row end" style={{ marginTop: 14 }}>
            <button type="button" className="btn" onClick={() => { setForm(EMPTY); setEdit(null); }}>Cancelar</button>
            <button className="btn primary" type="submit">Salvar</button>
          </div>
        </form>
      )}

      <div className="panel scroll-x">
        <table>
          <thead><tr><th>Texto</th><th>Fonte</th><th>Status</th><th>Criada</th><th>Ações</th></tr></thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id}>
                <td style={{ maxWidth: 380 }}>{c.text.slice(0, 160)}{c.text.length > 160 ? '…' : ''}</td>
                <td className="muted">{c.source_name || '—'}</td>
                <td>
                  {c.status === 'published' && <span className="tag green">publicada</span>}
                  {c.status === 'pending' && <span className="tag red">pendente</span>}
                  {c.status === 'draft' && <span className="tag gray">rascunho</span>}
                </td>
                <td className="muted">{c.created_at}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn small" onClick={() => { setEdit(c); setForm({ ...c, _open: 1 }); }}>Editar</button>
                    {c.status !== 'published' && <button className="btn small" onClick={() => setStatus(c, 'published')}>Aprovar</button>}
                    {c.status === 'published' && <button className="btn small" onClick={() => setStatus(c, 'pending')}>Enviar p/ fila</button>}
                    <button className="btn small danger" onClick={() => remove(c)}>Excluir</button>
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
