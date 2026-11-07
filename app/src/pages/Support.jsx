import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Loader, Empty } from '../components/Ui.jsx';

const TYPE_LABEL = { pix: 'Pix', kofi: 'Ko-fi', buymeacoffee: 'Buy Me a Coffee', patreon: 'Patreon', paypal: 'PayPal', github: 'GitHub Sponsors', custom: 'Apoiar' };

export default function Support() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qr, setQr] = useState(null);
  const [form, setForm] = useState({ name: '', message: '' });
  const [sent, setSent] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/support')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openButton = (b) => {
    api.post('/support/click', { button_id: b.id }).then(d => {
      if (b.type === 'pix') {
        api.get(`/support/pix/${b.id}`).then(r => setQr(r)).catch(() => setQr({ error: 'QR Code indisponível no momento.' }));
      } else if (d.url) {
        window.open(d.url, '_blank', 'noopener');
      }
    }).catch(() => {});
  };

  const send = (e) => {
    e.preventDefault();
    api.post('/support/messages', form)
      .then(() => { setSent(true); setForm({ name: '', message: '' }); load(); })
      .catch(() => {});
  };

  if (loading) return <div className="screen"><Loader /></div>;
  if (error) return <div className="screen"><Empty>{error}</Empty></div>;
  if (!data || data.enabled === false) {
    return (
      <div className="screen">
        <header className="topbar"><h1>Apoie este Criador</h1></header>
        <Empty>Esta seção está temporariamente desativada.</Empty>
      </div>
    );
  }

  const creator = data.creator || {};
  const goal = data.goal || { target: 0, raised: 0, month: '' };
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.raised / goal.target) * 100)) : 0;
  const initial = (creator.name || 'C').trim().charAt(0).toUpperCase();

  return (
    <div className="screen">
      <header className="topbar">
        <h1>Apoie este Criador</h1>
        <p>Transparente, opcional e sem anúncios</p>
      </header>

      <section className="card">
        <div className="row" style={{ alignItems: 'center', gap: 14 }}>
          {creator.avatar
            ? <img className="avatar" src={creator.avatar} alt={creator.name} />
            : <div className="avatar">{initial}</div>}
          <div style={{ flex: 1, minWidth: 160 }}>
            <h2 style={{ margin: '0 0 4px' }}>{creator.name}</h2>
            {creator.bio && <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>{creator.bio}</p>}
          </div>
        </div>
        {creator.message && (
          <p style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', fontSize: '0.88rem' }}>
            “{creator.message}”
          </p>
        )}
      </section>

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <b style={{ fontSize: '0.9rem' }}>Meta do mês {goal.month ? `· ${goal.month}` : ''}</b>
          <span className="muted">{pct}%</span>
        </div>
        <div className="progress"><span style={{ width: `${pct}%` }} /></div>
        <p className="muted" style={{ marginTop: 8 }}>
          {goal.raised ? `R$ ${Number(goal.raised).toFixed(2).replace('.', ',')}` : 'R$ 0,00'} de{' '}
          {goal.target ? `R$ ${Number(goal.target).toFixed(2).replace('.', ',')}` : '—'}
        </p>
      </section>

      <h3 style={{ margin: '6px 2px 0', fontSize: '0.95rem' }}>Como apoiar</h3>
      <div className="row">
        {(data.buttons || []).map(b => (
          <button key={b.id} className={`btn${b.type === 'pix' ? ' primary' : ''}`} style={{ flex: 1, minWidth: 130 }} onClick={() => openButton(b)}>
            {TYPE_LABEL[b.type] || b.label}
          </button>
        ))}
      </div>
      {(data.buttons || []).length === 0 && <Empty>Nenhuma forma de apoio configurada ainda.</Empty>}

      {qr && !qr.error && (
        <section className="card fade-in" style={{ textAlign: 'center' }}>
          <h3>{qr.label} — escaneie o QR Code</h3>
          <img className="qr" src={qr.qr} alt="QR Code Pix" style={{ margin: '12px auto', display: 'block' }} />
          <p className="muted">Abra o app do seu banco → Pix → Ler QR Code.</p>
        </section>
      )}
      {qr && qr.error && <Empty>{qr.error}</Empty>}

      <form className="card" onSubmit={send}>
        <h3>Deixe uma mensagem de apoio</h3>
        <p className="muted" style={{ marginTop: 0 }}>Sua mensagem passa pela moderação antes de aparecer na lista pública.</p>
        <label htmlFor="sup-name">Nome (opcional)</label>
        <input id="sup-name" maxLength={60} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Como quer ser chamado" />
        <label htmlFor="sup-msg">Mensagem</label>
        <textarea id="sup-msg" required maxLength={1000} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Escreva sua mensagem de apoio." />
        <div style={{ marginTop: 12 }}>
          <button className="btn primary wide" type="submit">Enviar mensagem</button>
        </div>
        {sent && <p className="muted" style={{ color: '#047857', marginTop: 10 }}>Mensagem enviada! Obrigado.</p>}
      </form>

      {data.supporters && data.supporters.length > 0 && (
        <>
          <h3 style={{ margin: '6px 2px 0', fontSize: '0.95rem' }}>Mensagens públicas</h3>
          {data.supporters.map(s => (
            <div key={s.id} className="message fade-in">
              <b>{s.name || 'Anônimo'}</b>
              {s.message}
              {s.response && <div className="resposta">Resposta do criador: {s.response}</div>}
            </div>
          ))}
        </>
      )}

      <p className="footer-note">O Open History não tem anúncios. Se o app te ajuda, apoiar mantém o projeto vivo.</p>
    </div>
  );
}
