import { api } from '../api.js';
import { useAsync } from '../hooks.js';
import { Loader, Empty } from '../components/Ui.jsx';
import { useState } from 'react';

export default function Curiosities() {
  const { data, loading } = useAsync(() => api.get('/curiosities'), []);
  const [form, setForm] = useState({ type: 'curiosidade', content: '', contact: '' });
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);

  const send = (e) => {
    e.preventDefault();
    setError(null);
    api.post('/feedback', form)
      .then(() => { setSent('Obrigado! Sua sugestão entrou na fila de moderação.'); setForm({ type: 'curiosidade', content: '', contact: '' }); })
      .catch(e => setError(e.message));
  };

  const items = data ? data.curiosities : [];

  return (
    <div className="screen">
      <header className="topbar">
        <h1>Curiosidades</h1>
        <p>Você sabia? — fatos verificados da Wikipédia e da curadoria</p>
      </header>

      {loading && <Loader text="Reunindo curiosidades…" />}
      {!loading && items.length === 0 && <Empty>Nenhuma curiosidade publicada ainda.</Empty>}
      {items.map((c, i) => (
        <article key={`${c.id}-${i}`} className="card fade-in">
          <span className="badge">{c.origin === 'wikipedia' ? 'Você sabia?' : 'Curadoria'}</span>
          <h3>{c.title}</h3>
          <p>{c.text}</p>
          <div className="meta">
            <span>{c.source_name}</span>
            {c.source_url && <a href={c.source_url} target="_blank" rel="noopener noreferrer">Ler mais</a>}
          </div>
        </article>
      ))}

      <div className="divider" />

      <form className="card" onSubmit={send}>
        <h3>Sugerir uma curiosidade ou correção</h3>
        <label htmlFor="tipo">Tipo</label>
        <select id="tipo" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
          <option value="curiosidade">Curiosidade</option>
          <option value="sugestao">Sugestão</option>
          <option value="correcao">Correção</option>
        </select>
        <label htmlFor="conteudo">Sua mensagem</label>
        <textarea id="conteudo" required maxLength={2000} value={form.content}
          onChange={e => setForm({ ...form, content: e.target.value })}
          placeholder="Conte um fato histórico com fonte, se possível." />
        <label htmlFor="contato">Contato (opcional)</label>
        <input id="contato" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="e-mail para resposta" />
        {error && <p className="muted" style={{ color: '#b91c1c' }}>{error}</p>}
        {sent && <p className="muted" style={{ color: '#047857' }}>{sent}</p>}
        <div style={{ marginTop: 12 }}>
          <button className="btn primary wide" type="submit">Enviar para moderação</button>
        </div>
      </form>
    </div>
  );
}
