import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function SettingsAd() {
  const [form, setForm] = useState({
    home: { title: '', subtitle: '', welcome: '' },
    sections: { search: true, curiosities: true, feedback: true, support: true },
    feedLimit: 12,
    randomRotation: true,
    categories: [],
  });
  const [notice, setNotice] = useState(null);
  const [catInput, setCatInput] = useState('');

  const load = () => {
    api.get('/admin/settings').then(d => setForm(f => ({ ...f, ...d }))).catch(e => flash(e.message));
  };

  useEffect(() => { load(); }, []);

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(null), 3000); };

  const save = (e) => {
    e.preventDefault();
    api.put('/admin/settings', form).then(() => flash('Configurações salvas e aplicadas ao app')).catch(err => flash(err.message));
  };

  const addCat = () => {
    const v = catInput.trim();
    if (!v) return;
    setForm({ ...form, categories: [...form.categories, v] });
    setCatInput('');
  };

  const removeCat = (i) => setForm({ ...form, categories: form.categories.filter((_, idx) => idx !== i) });

  return (
    <>
      <div className="page-head"><h1>Configurações do app</h1><p>Textos, limites e seções — refletidos no app na hora (SSE).</p></div>

      {notice && <div className="panel" style={{ borderColor: '#bfdbfe' }}>{notice}</div>}

      <form className="panel" onSubmit={save}>
        <h3>Tela inicial</h3>
        <div className="form-grid">
          <div><label>Título</label><input value={form.home.title} onChange={e => setForm({ ...form, home: { ...form.home, title: e.target.value } })} /></div>
          <div><label>Subtítulo</label><input value={form.home.subtitle} onChange={e => setForm({ ...form, home: { ...form.home, subtitle: e.target.value } })} /></div>
          <div className="full"><label>Boas-vindas</label><textarea rows={2} value={form.home.welcome} onChange={e => setForm({ ...form, home: { ...form.home, welcome: e.target.value } })} /></div>
        </div>

        <h3 style={{ marginTop: 20 }}>Seções</h3>
        <div className="row">
          {Object.entries({ search: 'Busca', curiosities: 'Curiosidades', feedback: 'Feedback', support: 'Apoiar' }).map(([k, label]) => (
            <label key={k} className="row" style={{ margin: 0, fontWeight: 500, fontSize: '0.85rem' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.sections[k]} onChange={e => setForm({ ...form, sections: { ...form.sections, [k]: e.target.checked } })} />
              {label}
            </label>
          ))}
        </div>

        <h3 style={{ marginTop: 20 }}>Feed</h3>
        <div className="form-grid">
          <div><label>Limite de fatos no feed</label>
            <input type="number" min="1" max="50" value={form.feedLimit} onChange={e => setForm({ ...form, feedLimit: Number(e.target.value) })} />
          </div>
          <div><label>Rotação aleatória do fato</label>
            <select value={form.randomRotation ? 'sim' : 'nao'} onChange={e => setForm({ ...form, randomRotation: e.target.value === 'sim' })}>
              <option value="sim">sim</option>
              <option value="nao">não</option>
            </select>
          </div>
        </div>

        <h3 style={{ marginTop: 20 }}>Categorias e períodos</h3>
        <div className="row">
          <div className="grow"><input value={catInput} onChange={e => setCatInput(e.target.value)} placeholder="Nova categoria" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } }} /></div>
          <button type="button" className="btn" onClick={addCat}>Adicionar</button>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {form.categories.map((c, i) => (
            <span key={i} className="tag blue">{c} <button type="button" className="btn small ghost" style={{ padding: '0 2px', border: 'none' }} onClick={() => removeCat(i)}>×</button></span>
          ))}
          {form.categories.length === 0 && <span className="muted">Nenhuma categoria cadastrada.</span>}
        </div>

        <div className="row end" style={{ marginTop: 18 }}><button className="btn primary">Salvar configurações</button></div>
      </form>
    </>
  );
}
