import { useEffect, useState } from 'react';
import { api } from '../api.js';

const TYPES = [
  { value: 'pix', label: 'Pix (QR dinâmico)' },
  { value: 'kofi', label: 'Ko-fi' },
  { value: 'buymeacoffee', label: 'Buy Me a Coffee' },
  { value: 'patreon', label: 'Patreon' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'github', label: 'GitHub Sponsors' },
  { value: 'custom', label: 'Link personalizado' },
];

const EMPTY_BTN = { label: '', type: 'kofi', url: '', pix_key: '', pix_name: '', pix_city: '', amount: '', active: true, sort: 0 };

export default function SupportAdmin() {
  const [data, setData] = useState(null);
  const [creator, setCreator] = useState({ name: '', avatar: '', bio: '', message: '', supportEnabled: true });
  const [goal, setGoal] = useState({ month: '', target: 0, raised: 0 });
  const [btnForm, setBtnForm] = useState(EMPTY_BTN);
  const [editBtn, setEditBtn] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = () => api.get('/admin/support').then(d => {
    setData(d);
    setCreator({ ...d.creator, supportEnabled: d.supportEnabled });
    setGoal(d.goal);
  }).catch(e => flash(e.message));

  useEffect(() => { load(); }, []);

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(null), 3500); };

  const saveCreator = (e) => {
    e.preventDefault();
    api.put('/admin/support/creator', creator).then(() => flash('Criador atualizado')).catch(err => flash(err.message));
  };

  const saveGoal = (e) => {
    e.preventDefault();
    api.put('/admin/support/goal', goal).then(() => flash('Meta atualizada')).catch(err => flash(err.message));
  };

  const saveBtn = (e) => {
    e.preventDefault();
    const payload = { ...btnForm };
    delete payload._open;
    const action = editBtn ? api.put(`/admin/support/buttons/${editBtn.id}`, payload) : api.post('/admin/support/buttons', payload);
    action
      .then(() => { setBtnForm(EMPTY_BTN); setEditBtn(null); return load(); })
      .then(() => flash('Botão salvo'))
      .catch(err => flash(err.message));
  };

  const delBtn = (b) => {
    if (!window.confirm(`Remover o botão "${b.label}"?`)) return;
    api.del(`/admin/support/buttons/${b.id}`).then(load).catch(err => flash(err.message));
  };

  const moderate = (m, patch) => api.put(`/admin/support/messages/${m.id}`, patch).then(load).catch(err => flash(err.message));

  if (!data) return <div className="loading">Carregando…</div>;

  return (
    <>
      <div className="page-head"><h1>Apoie este Criador</h1><p>Tudo editável: criador, botões, meta Pix e moderação de mensagens.</p></div>

      {notice && <div className="panel" style={{ borderColor: '#bfdbfe' }}>{notice}</div>}

      <div className="grid cols-2">
        <form className="panel" onSubmit={saveCreator}>
          <h3>Criador</h3>
          <label>Nome</label>
          <input value={creator.name} onChange={e => setCreator({ ...creator, name: e.target.value })} />
          <label>Avatar (URL)</label>
          <input value={creator.avatar} onChange={e => setCreator({ ...creator, avatar: e.target.value })} placeholder="https://…/foto.jpg" />
          <label>Bio</label>
          <textarea rows={2} value={creator.bio} onChange={e => setCreator({ ...creator, bio: e.target.value })} />
          <label>Mensagem de agradecimento</label>
          <textarea rows={2} value={creator.message} onChange={e => setCreator({ ...creator, message: e.target.value })} />
          <label>Seção ativa no app</label>
          <select value={creator.supportEnabled ? 'sim' : 'nao'} onChange={e => setCreator({ ...creator, supportEnabled: e.target.value === 'sim' })}>
            <option value="sim">sim</option>
            <option value="nao">não</option>
          </select>
          <div className="row end" style={{ marginTop: 12 }}><button className="btn primary">Salvar criador</button></div>
        </form>

        <form className="panel" onSubmit={saveGoal}>
          <h3>Meta de arrecadação</h3>
          <label>Mês de referência</label>
          <input value={goal.month} onChange={e => setGoal({ ...goal, month: e.target.value })} placeholder="2026-11" />
          <label>Meta (R$)</label>
          <input type="number" min="0" step="0.01" value={goal.target} onChange={e => setGoal({ ...goal, target: Number(e.target.value) })} />
          <label>Arrecadado (R$)</label>
          <input type="number" min="0" step="0.01" value={goal.raised} onChange={e => setGoal({ ...goal, raised: Number(e.target.value) })} />
          <p className="muted">Atualização manual ou via webhook (Mercado Pago/Stripe) integrada ao backend.</p>
          <div className="row end"><button className="btn primary">Salvar meta</button></div>
        </form>
      </div>

      <form className="panel" onSubmit={saveBtn}>
        <h3>{editBtn ? `Editar botão: ${editBtn.label}` : 'Novo botão de apoio'}</h3>
        <div className="form-grid">
          <div><label>Rótulo</label><input value={btnForm.label} onChange={e => setBtnForm({ ...btnForm, label: e.target.value })} placeholder="Pix, Ko-fi…" /></div>
          <div><label>Tipo</label>
              <select value={btnForm.type} onChange={e => setBtnForm({ ...btnForm, type: e.target.value })}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
          </div>
          {btnForm.type === 'pix' ? (
            <>
              <div><label>Chave Pix</label><input value={btnForm.pix_key} onChange={e => setBtnForm({ ...btnForm, pix_key: e.target.value })} /></div>
              <div><label>Nome do recebedor</label><input value={btnForm.pix_name} onChange={e => setBtnForm({ ...btnForm, pix_name: e.target.value })} /></div>
              <div><label>Cidade</label><input value={btnForm.pix_city} onChange={e => setBtnForm({ ...btnForm, pix_city: e.target.value })} placeholder="BRASIL" /></div>
              <div><label>Valor sugerido (opcional)</label><input value={btnForm.amount} onChange={e => setBtnForm({ ...btnForm, amount: e.target.value })} placeholder="10.00" /></div>
            </>
          ) : (
            <div className="full"><label>URL</label><input value={btnForm.url} onChange={e => setBtnForm({ ...btnForm, url: e.target.value })} placeholder="https://ko-fi.com/…" /></div>
          )}
          <div><label>Ordem</label><input type="number" value={btnForm.sort} onChange={e => setBtnForm({ ...btnForm, sort: Number(e.target.value) })} /></div>
          <div><label>Ativo</label>
            <select value={btnForm.active ? 'sim' : 'nao'} onChange={e => setBtnForm({ ...btnForm, active: e.target.value === 'sim' })}>
              <option value="sim">sim</option>
              <option value="nao">não</option>
            </select>
          </div>
        </div>
        <div className="row end" style={{ marginTop: 12 }}>
          {editBtn && <button type="button" className="btn" onClick={() => { setEditBtn(null); setBtnForm(EMPTY_BTN); }}>Cancelar</button>}
          <button className="btn primary">{editBtn ? 'Salvar botão' : 'Criar botão'}</button>
        </div>
      </form>

      <div className="panel scroll-x">
        <h3>Botões</h3>
        <table>
          <thead><tr><th>Rótulo</th><th>Tipo</th><th>Destino</th><th>Cliques</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {data.buttons.map(b => (
              <tr key={b.id}>
                <td>{b.label}</td>
                <td className="muted">{b.type}</td>
                <td className="muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.type === 'pix' ? b.pix_key : b.url}</td>
                <td>{b.clicks}</td>
                <td>{b.active ? <span className="tag green">ativo</span> : <span className="tag gray">inativo</span>}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn small" onClick={() => { setEditBtn(b); setBtnForm({ ...b, active: !!b.active, _open: 1 }); }}>Editar</button>
                    <button className="btn small danger" onClick={() => delBtn(b)}>Remover</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel scroll-x">
        <h3>Mensagens de apoiadores</h3>
        {data.messages.length === 0 ? <div className="empty">Nenhuma mensagem ainda.</div> : (
          <table>
            <thead><tr><th>Quando</th><th>Nome</th><th>Mensagem</th><th>Visível</th><th>Resposta</th><th>Ações</th></tr></thead>
            <tbody>
              {data.messages.map(m => (
                <tr key={m.id}>
                  <td className="muted">{m.created_at}</td>
                  <td>{m.name}</td>
                  <td style={{ maxWidth: 260 }}>{m.message}</td>
                  <td>{m.visible ? <span className="tag green">sim</span> : <span className="tag gray">não</span>}</td>
                  <td style={{ maxWidth: 200 }}>{m.response || '—'}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn small" onClick={() => { const r = window.prompt('Resposta pública:', m.response || ''); if (r !== null) moderate(m, { visible: true, response: r }); }}>Responder</button>
                      <button className="btn small" onClick={() => moderate(m, { visible: !m.visible })}>{m.visible ? 'Ocultar' : 'Aprovar'}</button>
                      <button className="btn small danger" onClick={() => api.del(`/admin/support/messages/${m.id}`).then(load).catch(err => flash(err.message))}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
