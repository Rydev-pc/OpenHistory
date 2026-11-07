import { useEffect, useState } from 'react';
import { api } from '../api.js';

const EMPTY_FACT = { title: '', short_desc: '', full_text: '', source_name: '', source_url: '', category: 'Geral', period: '', image_url: '', status: 'published' };

export default function Facts() {
  const [facts, setFacts] = useState([]);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY_FACT);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/admin/facts').then(d => setFacts(d.items)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(null), 3000); };

  const save = (e) => {
    e.preventDefault();
    const action = edit ? api.put(`/admin/facts/${edit.id}`, form) : api.post('/admin/facts', form);
    action
      .then(() => { setEdit(null); setForm(EMPTY_FACT); load(); flash('Fato salvo'); })
      .catch(err => flash(err.message));
  };

  const remove = (f) => {
    if (!window.confirm(`Excluir "${f.title}"?`)) return;
    api.del(`/admin/facts/${f.id}`).then(load).catch(err => flash(err.message));
  };

  const toggleStatus = (f) => {
    api.put(`/admin/facts/${f.id}`, { ...f, status: f.status === 'published' ? 'draft' : 'published' })
      .then(load)
      .catch(err => flash(err.message));
  };

  if (loading) return <div className="loading">Carregando fatos…</div>;

  return (
    <>
      <div className="page-head"><h1>Fatos</h1><p>CRUD de fatos históricos — o feed do app reflete as alterações na hora.</p></div>

      <div className="row end">{notice && <span className="muted grow">{notice}</span>}<button className="btn primary" onClick={() => { setEdit(null); setForm({ ...EMPTY_FACT, _open: 1 }); }}>+ Novo fato</button></div>

      {form._open && (
        <form className="panel" onSubmit={save}>
          <h3>{edit ? `Editar: ${edit.title}` : 'Novo fato'}</h3>
          <div className="form-grid">
            <div className="full"><label>Título</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="full"><label>Descrição curta (cartão)</label><textarea rows={2} value={form.short_desc} onChange={e => setForm({ ...form, short_desc: e.target.value })} /></div>
            <div className="full"><label>Texto completo</label><textarea rows={5} value={form.full_text} onChange={e => setForm({ ...form, full_text: e.target.value })} /></div>
            <div><label>Fonte (nome)</label><input value={form.source_name} onChange={e => setForm({ ...form, source_name: e.target.value })} placeholder="Wikipédia (pt)" /></div>
            <div><label>Fonte (URL)</label><input value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} placeholder="https://pt.wikipedia.org/wiki/…" /></div>
            <div><label>Categoria</label><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
            <div><label>Período</label><input value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} placeholder="Século XIX" /></div>
            <div><label>Imagem (URL)</label><input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} /></div>
            <div><label>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="published">publicado</option>
                <option value="draft">rascunho</option>
              </select>
            </div>
          </div>
          <div className="row end" style={{ marginTop: 14 }}>
            <button type="button" className="btn" onClick={() => { setForm(EMPTY_FACT); setEdit(null); }}>Cancelar</button>
            <button className="btn primary" type="submit">Salvar</button>
          </div>
        </form>
      )}

      <div className="panel scroll-x">
        <table>
          <thead><tr><th>Título</th><th>Categoria</th><th>Período</th><th>Fonte</th><th>Status</th><th>Views</th><th>Ações</th></tr></thead>
          <tbody>
            {facts.map(f => (
              <tr key={f.id}>
                <td style={{ maxWidth: 260 }}>{f.title}</td>
                <td className="muted">{f.category}</td>
                <td className="muted">{f.period || '—'}</td>
                <td className="muted">{f.source_name || '—'}</td>
                <td>{f.status === 'published' ? <span className="tag green">publicado</span> : <span className="tag gray">rascunho</span>}</td>
                <td className="muted">{f.views}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn small" onClick={() => { setEdit(f); setForm({ ...f, _open: 1 }); }}>Editar</button>
                    <button className="btn small" onClick={() => toggleStatus(f)}>{f.status === 'published' ? 'Despublicar' : 'Publicar'}</button>
                    <button className="btn small danger" onClick={() => remove(f)}>Excluir</button>
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
