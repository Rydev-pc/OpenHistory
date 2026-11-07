import { useState } from 'react';
import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { FactCard, Loader, Empty } from '../components/Ui.jsx';

export default function Home({ settings }) {
  const home = settings.home || {};
  const limit = settings.feedLimit || 12;
  const day = useAsync(() => api.get('/facts/day'), []);
  const feed = useAsync(() => api.get(`/facts?limit=${limit}`), [limit]);
  const [random, setRandom] = useState(null);
  const [loadingRandom, setLoadingRandom] = useState(false);

  const surprise = () => {
    setLoadingRandom(true);
    api.get('/facts/random')
      .then(d => setRandom(d.fact))
      .catch(() => setRandom(null))
      .finally(() => setLoadingRandom(false));
  };

  return (
    <div className="screen">
      <header className="topbar">
        <h1>{home.title || 'Open History'}</h1>
        {home.subtitle && <p>{home.subtitle}</p>}
      </header>

      <p className="muted" style={{ padding: '0 2px' }}>{home.welcome}</p>

      {day.loading && <Loader text="Buscando o fato do dia…" />}
      {day.error && <Empty>Nenhum fato publicado ainda.</Empty>}
      {day.data && <FactCard fact={day.data.fact} hero />}

      <button className="btn primary wide" onClick={surprise} disabled={loadingRandom}>
        {loadingRandom ? 'Sorteando…' : 'Surpreenda-me'}
      </button>

      {random && <FactCard fact={random} />}

      <div className="divider" />
      <h2 style={{ fontSize: '0.95rem', margin: '4px 2px' }}>Feed de fatos</h2>

      {feed.loading && <Loader />}
      {feed.data && feed.data.facts.length === 0 && <Empty>Nenhum fato no feed por enquanto.</Empty>}
      {feed.data && feed.data.facts.map(f => <FactCard key={f.id} fact={f} />)}

      <p className="footer-note">Conteúdo de fontes públicas (Wikipédia e parceiros), curado pela equipe Open History.</p>
    </div>
  );
}
