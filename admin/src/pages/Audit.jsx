import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Audit() {
  const [data, setData] = useState({ logs: [], logins: [] });
  const [tab, setTab] = useState('logs');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/admin/audit?limit=300').then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const rows = tab === 'logs' ? data.logs : data.logins;

  return (
    <>
      <div className="page-head"><h1>Logs de auditoria</h1><p>Ações administrativas e histórico de acessos — somente administradores.</p></div>

      <div className="row">
        <button className={`btn${tab === 'logs' ? ' primary' : ''}`} onClick={() => setTab('logs')}>Ações administrativas</button>
        <button className={`btn${tab === 'logins' ? ' primary' : ''}`} onClick={() => setTab('logins')}>Logins e tentativas</button>
        <div className="grow" />
        <button className="btn" onClick={load}>Atualizar</button>
      </div>

      <div className="panel scroll-x">
        {loading ? <div className="loading">Carregando…</div> : (
          <table>
            <thead><tr><th>#</th><th>Quando</th><th>Autor</th><th>Ação</th><th>Entidade</th><th>ID</th><th>Antes → Depois</th></tr></thead>
            <tbody>
              {rows.map(l => (
                <tr key={l.id}>
                  <td className="muted">{l.id}</td>
                  <td className="muted">{l.created_at}</td>
                  <td>{l.actor_email || '—'}</td>
                  <td><span className="tag blue">{l.action}</span></td>
                  <td className="muted">{l.entity}</td>
                  <td className="muted">{l.entity_id || '—'}</td>
                  <td className="muted" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.old_value ? <span title={l.old_value}>{l.old_value}</span> : ''}
                    {l.old_value && l.new_value ? ' → ' : ''}
                    {l.new_value ? <span title={l.new_value}>{l.new_value}</span> : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && rows.length === 0 && <div className="empty">Nenhum registro.</div>}
      </div>
    </>
  );
}
