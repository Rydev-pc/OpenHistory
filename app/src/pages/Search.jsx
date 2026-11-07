import { useState } from 'react';
import { api } from '../api.js';
import { Loader, Empty } from '../components/Ui.jsx';

export default function Search() {
  const [term, setTerm] = useState('');
  const [wiki, setWiki] = useState(null);
  const [local, setLocal] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const run = (raw) => {
    const q = String(raw || term).trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    Promise.all([
      api.get(`/wikipedia?q=${encodeURIComponent(q)}`).catch(e => ({ results: [], error: e.message })),
      api.get('/facts?limit=50').catch(() => ({ facts: [] })),
    ])
      .then(([w, f]) => {
        setWiki(w);
        const needle = q.toLowerCase();
        setLocal((f.facts || []).filter(x =>
          x.title.toLowerCase().includes(needle) ||
          (x.short_desc || '').toLowerCase().includes(needle) ||
          (x.category || '').toLowerCase().includes(needle)
        ));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="screen">
      <header className="topbar">
        <h1>Buscar</h1>
        <p>Pesquise termos históricos na Wikipédia em português</p>
      </header>

      <form
        className="row"
        onSubmit={e => { e.preventDefault(); run(); }}
        style={{ alignItems: 'stretch' }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="Ex.: Revolução Francesa, Cleópatra, soma…"
            aria-label="Termo de busca"
          />
        </div>
        <button className="btn primary" type="submit" disabled={loading || !term.trim()}>
          {loading ? 'Buscando…' : 'Pesquisar'}
        </button>
      </form>

      <div className="pill-list">
        {['Revolução Francesa', 'Antigo Egito', 'Segunda Guerra', 'Brasil Colônia', 'Renascimento'].map(s => (
          <button key={s} className="btn small ghost" onClick={() => { setTerm(s); run(s); }}>{s}</button>
        ))}
      </div>

      {loading && <Loader text="Consultando acervos…" />}
      {error && <Empty>{error}</Empty>}

      {!loading && searched && (
        <>
          {local.length > 0 && (
            <>
              <h3 style={{ margin: '8px 2px 0', fontSize: '0.9rem' }}>No Open History</h3>
              {local.slice(0, 5).map(f => (
                <article key={`l-${f.id}`} className="card fade-in">
                  <span className="badge">{f.category}</span>
                  <h3>{f.title}</h3>
                  <p>{f.short_desc}</p>
                  <div className="meta">
                    <span>{f.source_name || 'Open History'}</span>
                    {f.source_url && <a href={f.source_url} target="_blank" rel="noopener noreferrer">Fonte</a>}
                  </div>
                </article>
              ))}
            </>
          )}

          <h3 style={{ margin: '8px 2px 0', fontSize: '0.9rem' }}>Wikipédia (pt)</h3>
          {(!wiki || wiki.results.length === 0) ? (
            <Empty>{wiki && wiki.error ? `Wikipédia indisponível: ${wiki.error}` : 'Nenhum resultado encontrado.'}</Empty>
          ) : (
            wiki.results.map((r, i) => (
              <article key={i} className="card fade-in">
                <div className="result-title">{r.title}</div>
                <p className="result-snippet">{r.summary}</p>
                <div className="meta">
                  <span>{r.source}</span>
                  <a href={r.url} target="_blank" rel="noopener noreferrer">Ler mais na Wikipédia</a>
                </div>
              </article>
            ))
          )}
        </>
      )}
    </div>
  );
}
