export function Loader({ text = 'Carregando…' }) {
  return (
    <div className="loader">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  );
}

export function FactCard({ fact, hero = false }) {
  return (
    <article className={`card fade-in${hero ? ' hero' : ''}`}>
      {fact.period && <span className="badge">{fact.period}</span>}
      <h2>{fact.title}</h2>
      <p>{hero ? fact.full_text || fact.short_desc : fact.short_desc}</p>
      <div className="meta">
        <span>
          {fact.category ? fact.category + ' · ' : ''}
          {fact.source_name || 'Open History'}
        </span>
        {fact.source_url && (
          <a href={fact.source_url} target="_blank" rel="noopener noreferrer">Fonte</a>
        )}
      </div>
    </article>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}
