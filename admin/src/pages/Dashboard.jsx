import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../api.js';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [chart, setChart] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    Promise.all([
      api.get('/admin/metrics').catch(e => { throw e; }),
      api.get('/admin/charts/accesses?hours=24').catch(() => ({ series: [] })),
    ])
      .then(([m, c]) => { setMetrics(m); setChart(c.series || []); setError(null); })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    const es = new EventSource('/api/stream');
    const bump = () => load();
    ['support', 'users', 'audit', 'suggestions', 'facts', 'curiosities'].forEach(t => es.addEventListener(t, bump));
    return () => { clearInterval(timer); es.close(); };
  }, [load]);

  if (error) return <div className="empty">Falha ao carregar métricas: {error}</div>;
  if (!metrics) return <div className="loading">Carregando painel…</div>;

  const goal = metrics.support.goal || { target: 0, raised: 0 };
  const goalPct = goal.target > 0 ? Math.min(100, Math.round((goal.raised / goal.target) * 100)) : 0;
  const money = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <p><span className="live-dot" /> Dados em tempo real — atualiza a cada 10s e via eventos</p>
      </div>

      <div className="grid cols-4">
        <div className="stat hot"><div className="n">{(metrics.presence.activeSessions.length || 0) + metrics.presence.anonymousActive}</div><div className="l">Usuários ativos agora</div></div>
        <div className="stat"><div className="n">{metrics.users.total}</div><div className="l">Total de usuários (+{metrics.users.newToday} hoje)</div></div>
        <div className="stat"><div className="n">{metrics.content.facts}</div><div className="l">Fatos publicados</div></div>
        <div className="stat"><div className="n">{metrics.support.clicksToday}</div><div className="l">Cliques de apoio hoje</div></div>
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <h3>Acessos e buscas por hora (24h)</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f4" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="accesses" name="Acessos" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="searches" name="Buscas" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <h3>Termos mais buscados</h3>
          {metrics.engagement.topTerms.length === 0 ? <div className="empty">Nenhuma busca registrada ainda.</div> : (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.engagement.topTerms} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f4" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="term" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="n" name="Buscas" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid cols-2">
        <div className="panel">
          <h3>Sessões ativas (últimos 5 min)</h3>
          {metrics.presence.activeSessions.length === 0
            ? <div className="empty">Nenhuma sessão autenticada ativa. Anônimos: {metrics.presence.anonymousActive}</div>
            : (
              <div className="scroll-x">
                <table>
                  <thead><tr><th>Usuário</th><th>Dispositivo</th><th>IP</th><th>Visto</th></tr></thead>
                  <tbody>
                    {metrics.presence.activeSessions.map(s => (
                      <tr key={s.jti}>
                        <td>{s.name || s.email}<div className="muted">{s.email}</div></td>
                        <td className="muted" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.device || '—'}</td>
                        <td>{s.ip || '—'}</td>
                        <td className="muted">{s.last_seen}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        <div className="panel">
          <h3>Meta de apoio do mês</h3>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{money(goal.raised)}</b><span className="muted">de {money(goal.target)} ({goalPct}%)</span>
          </div>
          <div className="bar" style={{ margin: '10px 0' }}><span style={{ width: `${goalPct}%` }} /></div>
          <div className="row" style={{ marginTop: 14 }}>
            <Link className="btn small" to="/apoio">Gerenciar apoio</Link>
            <span className="muted">Total de cliques: {metrics.support.clicksTotal}</span>
          </div>
          <div style={{ marginTop: 16 }}>
            {metrics.support.perButton.map((b, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span>{b.label}</span><span className="muted">{b.clicks} cliques</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid cols-3">
        <div className="panel">
          <h3>Fatos mais vistos</h3>
          <table>
            <tbody>
              {metrics.engagement.topFacts.map(f => (
                <tr key={f.id}><td>{f.title}</td><td className="muted" style={{ textAlign: 'right' }}>{f.views}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>Pendências</h3>
          <div className="row" style={{ justifyContent: 'space-between' }}>Sugestões/feedback <Link to="/feedback" className="tag red">{metrics.content.pendingSuggestions}</Link></div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>Curiosidades na fila <Link to="/curiosidades" className="tag red">{metrics.content.pendingCuriosities}</Link></div>
        </div>
        <div className="panel">
          <h3>Novos usuários</h3>
          <div className="row" style={{ justifyContent: 'space-between' }}>Hoje <b>{metrics.users.newToday}</b></div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>7 dias <b>{metrics.users.newWeek}</b></div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>30 dias <b>{metrics.users.newMonth}</b></div>
        </div>
      </div>
    </>
  );
}
