import { useEffect, useState } from 'react';
import { api } from '../api.js';

const TYPES = { sugestao: 'Sugestão', correcao: 'Correção', curiosidade: 'Curiosidade' };
const STATUS = { pending: ['pendente', 'red'], approved: ['aprovada', 'green'], rejected: ['rejeitada', 'gray'], answered: ['respondida', 'blue'] };

export default function Feedback() {
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/admin/suggestions').then(d => setItems(d.suggestions)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(null), 3000); };

  const act = (s, status) => {
    api.put(`/admin/suggestions/${s.id}`, { status }).then(load).catch(err => flash(err.message));
  };

  const answer = (s) => {
    const r = window.prompt('Resposta ao usuário:', s.response || '');
    if (r === null) return;
    api.put(`/admin/suggestions/${s.id}`, { status: 'answered', response: r }).then(load).catch(err => flash(err.message));
  };

  if (loading) return <div className="loading">Carregando…</div>;

  return (
    <>
      <div className="page-head"><h1>Feedback e sugestões</h1><p>Fila de moderação das mensagens enviadas pelos usuários.</p></div>

      {notice && <div className="panel">{notice}</div>}

      <div className="panel scroll-x">
        <table>
          <thead><tr><th>Quando</th><th>Tipo</th><th>Conteúdo</th><th>Contato</th><th>Status</th><th>Resposta</th><th>Ações</th></tr></thead>
          <tbody>
            {items.map(s => (
              <tr key={s.id}>
                <td className="muted">{s.created_at}</td>
                <td className="muted">{TYPES[s.type] || s.type}</td>
                <td style={{ maxWidth: 300 }}>{s.content}</td>
                <td className="muted">{s.contact || '—'}</td>
                <td><span className={`tag ${STATUS[s.status] ? STATUS[s.status][1] : 'gray'}`}>{STATUS[s.status] ? STATUS[s.status][0] : s.status}</span></td>
                <td className="muted" style={{ maxWidth: 160 }}>{s.response || '—'}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    {s.status === 'pending' && <button className="btn small" onClick={() => act(s, 'approved')}>Aprovar</button>}
                    {s.status === 'pending' && <button className="btn small danger" onClick={() => act(s, 'rejected')}>Rejeitar</button>}
                    <button className="btn small" onClick={() => answer(s)}>Responder</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="empty">Nenhuma mensagem recebida ainda.</div>}
      </div>
    </>
  );
}
