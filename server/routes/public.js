const express = require('express');
const rateLimit = require('../lib/ratelimit');
const { sanitizeHtml } = require('../lib/sanitize');
const { pixQrDataUrl } = require('../lib/pix');
const { broadcast } = require('../lib/sse');
const { audit } = require('../lib/middleware');
const db = require('../db');

const router = express.Router();

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

const WIKI_CACHE = new Map(); // key -> {at, data}
async function wikiFetch(url) {
  const hit = WIKI_CACHE.get(url);
  if (hit && Date.now() - hit.at < 1000 * 60 * 60) return hit.data;
  const res = await fetch(url, { headers: { 'User-Agent': 'OpenHistory/1.0 (guia de historia)' } });
  if (!res.ok) throw new Error('wikipedia ' + res.status);
  const data = await res.json();
  WIKI_CACHE.set(url, { at: Date.now(), data });
  return data;
}

// ---- configurações públicas do app (refletem painel admin) ----
router.get('/settings', (req, res) => {
  res.json({
    home: getSetting('home', { title: 'Open History', subtitle: 'Historia em pedacos', welcome: 'Explore fatos historicos de fontes confiaveis.' }),
    sections: getSetting('sections', { search: true, curiosities: true, feedback: true, support: true }),
    feedLimit: getSetting('feedLimit', 12),
    randomRotation: getSetting('randomRotation', true),
    creator: getSetting('creator', { name: 'Criador do Open History', avatar: '', bio: '', message: '' }),
    goal: getSetting('goal', { month: '', target: 0, raised: 0 }),
    supportEnabled: getSetting('supportEnabled', true),
  });
});

// ---- feed de fatos ----
router.get('/facts', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const facts = db.prepare(`SELECT * FROM facts WHERE status = 'published' ORDER BY created_at DESC, id DESC LIMIT ?`).all(limit);
  res.json({ facts });
});

router.get('/facts/day', (req, res) => {
  const count = db.prepare(`SELECT COUNT(*) AS n FROM facts WHERE status = 'published'`).get().n;
  if (!count) return res.status(404).json({ error: 'Nenhum fato publicado' });
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day = Math.floor((Date.now() - start) / 86400000);
  const fact = db.prepare(`SELECT * FROM facts WHERE status = 'published' ORDER BY id LIMIT 1 OFFSET ?`).get(day % count);
  res.json({ fact });
});

router.get('/facts/random', (req, res) => {
  const facts = db.prepare(`SELECT * FROM facts WHERE status = 'published'`).all();
  if (!facts.length) return res.status(404).json({ error: 'Nenhum fato publicado' });
  res.json({ fact: facts[Math.floor(Math.random() * facts.length)] });
});

router.get('/facts/:id', (req, res) => {
  const fact = db.prepare('SELECT * FROM facts WHERE id = ?').get(Number(req.params.id));
  if (!fact) return res.status(404).json({ error: 'Fato nao encontrado' });
  db.prepare('UPDATE facts SET views = views + 1 WHERE id = ?').run(fact.id);
  res.json({ fact });
});

// ---- curiosidades (locais + "Você sabia?" da Wikipédia) ----
router.get('/curiosities', async (req, res) => {
  const local = db.prepare(`SELECT * FROM curiosities WHERE status = 'published' ORDER BY created_at DESC LIMIT 20`).all();
  let wiki = [];
  try {
    const day = String(Math.floor(Math.random() * 27) + 1).padStart(2, '0');
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const dyk = await wikiFetch(`https://pt.wikipedia.org/w/api.php?action=query&list=embeddedin&eititle=Predefini%C3%A7%C3%A3o:Voc%C3%AA%20sabia%3F&einamespace=0&eilimit=15&format=json&origin=*`);
    const titles = (dyk.query && dyk.query.embeddedin ? dyk.query.embeddedin : []).map(p => p.title);
    if (!titles.length) throw new Error('sem dyk');
    const extracts = await wikiFetch(`https://pt.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exchars=400&format=json&origin=*&titles=${encodeURIComponent(titles.join('|'))}`);
    const pages = extracts.query && extracts.query.pages ? Object.values(extracts.query.pages) : [];
    wiki = pages.filter(p => p.extract).map(p => ({
      id: 'wiki-' + p.pageid,
      title: p.title,
      text: p.extract.split(/(?<=[.!?])\s/).slice(0, 2).join(' '),
      source_name: 'Wikipedia',
      source_url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
      origin: 'wikipedia',
    }));
  } catch {
    wiki = [];
  }
  res.json({ curiosities: [...local.map(c => ({ ...c, origin: 'local' })), ...wiki] });
});

router.get('/sources', (req, res) => {
  res.json({ sources: db.prepare('SELECT * FROM sources WHERE active = 1 ORDER BY name').all() });
});

// ---- busca na Wikipédia (proxy para não expor detalhes de rede) ----
router.get('/wikipedia', rateLimit({ max: 60 }), async (req, res) => {
  const term = String(req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 8, 20);
  if (!term) return res.json({ results: [] });
  try {
    const data = await wikiFetch(`https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=${limit}&format=json&origin=*`);
    const items = (data.query && data.query.search ? data.query.search : []).map(r => ({ title: r.title, snippet: sanitizeHtml(r.snippet) }));
    const titles = items.map(i => i.title);
    let extracts = [];
    if (titles.length) {
      const ex = await wikiFetch(`https://pt.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&format=json&origin=*&titles=${encodeURIComponent(titles.join('|'))}`);
      extracts = ex.query && ex.query.pages ? Object.values(ex.query.pages) : [];
    }
    const results = items.map(i => {
      const page = extracts.find(p => p.title === i.title);
      return {
        title: i.title,
        summary: (page && page.extract ? page.extract : i.snippet).slice(0, 600),
        url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(i.title.replace(/ /g, '_'))}`,
        source: 'Wikipédia (pt)',
      };
    });
    db.prepare('INSERT INTO searches (term, results) VALUES (?, ?)').run(term, results.length);
    res.json({ results });
  } catch (err) {
    res.status(502).json({ error: 'Falha ao consultar a Wikipedia', detail: String(err.message) });
  }
});

// ---- Europeana (opcional: requer EUROPEANA_KEY) ----
router.get('/europeana', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const key = process.env.EUROPEANA_KEY;
  if (!q) return res.json({ results: [] });
  if (!key) return res.status(503).json({ error: 'Europeana nao configurada', results: [] });
  try {
    const r = await fetch(`https://api.europeana.eu/record/v2/search.json?wskey=${key}&query=${encodeURIComponent(q)}&rows=12&media=true`);
    const data = await r.json();
    const results = (data.items || []).map(it => ({
      title: it.title ? it.title[0] : 'Documento historico',
      url: it.edmIsShownBy ? it.edmIsShownBy[0] : (it.guid ? `https://www.europeana.eu/item${it.guid}` : '#'),
      image: it.edmPreview ? it.edmPreview[0] : '',
      source: 'Europeana',
    }));
    res.json({ results });
  } catch (err) {
    res.status(502).json({ error: 'Falha ao consultar a Europeana' });
  }
});

// ---- Apoie este Criador ----
router.get('/support', (req, res) => {
  const enabled = getSetting('supportEnabled', true);
  const buttons = db.prepare('SELECT id, label, type, url, sort FROM support_buttons WHERE active = 1 ORDER BY sort, id').all()
    .map(b => (b.type === 'pix' ? { ...b, pix: true } : b));
  const supporters = db.prepare(`SELECT id, name, message, response, created_at FROM support_messages WHERE visible = 1 ORDER BY created_at DESC LIMIT 30`).all();
  res.json({
    enabled,
    creator: getSetting('creator', { name: 'Criador do Open History', avatar: '', bio: '', message: '' }),
    buttons,
    goal: getSetting('goal', { month: '', target: 0, raised: 0 }),
    supporters,
  });
});

router.get('/support/pix/:id', async (req, res) => {
  const btn = db.prepare('SELECT * FROM support_buttons WHERE id = ? AND type = ? AND active = 1').get(Number(req.params.id), 'pix');
  if (!btn || !btn.pix_key) return res.status(404).json({ error: 'Pix indisponivel' });
  const qr = await pixQrDataUrl({ key: btn.pix_key, name: btn.pix_name || 'Open History', city: btn.pix_city || 'BRASIL', amount: btn.amount || '' });
  if (!qr) return res.status(400).json({ error: 'Chave Pix nao configurada' });
  res.json({ qr, label: btn.label });
});

router.post('/support/click', rateLimit({ max: 120 }), (req, res) => {
  const btn = db.prepare('SELECT id, label FROM support_buttons WHERE id = ? AND active = 1').get(Number(req.body.button_id));
  if (!btn) return res.status(404).json({ error: 'Botao nao encontrado' });
  db.prepare('UPDATE support_buttons SET clicks = clicks + 1 WHERE id = ?').run(btn.id);
  db.prepare('INSERT INTO support_clicks (button_id, button_label) VALUES (?, ?)').run(btn.id, btn.label);
  broadcast('support', { reason: 'click', label: btn.label });
  res.json({ ok: true, url: db.prepare('SELECT url FROM support_buttons WHERE id = ?').get(btn.id).url });
});

router.post('/support/messages', rateLimit({ max: 10 }), (req, res) => {
  const message = String(req.body.message || '').trim().slice(0, 1000);
  if (!message) return res.status(400).json({ error: 'Escreva uma mensagem' });
  const info = db.prepare('INSERT INTO support_messages (name, message) VALUES (?, ?)')
    .run(sanitizeHtml(String(req.body.name || '').trim().slice(0, 60)) || 'Anonimo', sanitizeHtml(message));
  audit({ actor: null, action: 'support.message.created', entity: 'support_messages', entityId: info.lastInsertRowid });
  broadcast('support', { reason: 'message' });
  res.status(201).json({ ok: true });
});

// ---- feedback do usuário ----
router.post('/feedback', rateLimit({ max: 10 }), (req, res) => {
  const content = String(req.body.content || '').trim().slice(0, 2000);
  if (!content) return res.status(400).json({ error: 'Descreva sua sugestao' });
  const info = db.prepare('INSERT INTO suggestions (type, content, contact) VALUES (?, ?, ?)')
    .run(['sugestao', 'correcao', 'curiosidade'].includes(req.body.type) ? req.body.type : 'sugestao', sanitizeHtml(content), String(req.body.contact || '').slice(0, 120));
  broadcast('suggestions', { reason: 'created' });
  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

// ---- heartbeat / presenca ----
const { verifyJwt } = require('../lib/auth');
const anon = new Map(); // ip -> timestamp

router.post('/heartbeat', rateLimit({ max: 240 }), (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  const path = String(req.body.path || '/').slice(0, 120);
  const now = Date.now();
  for (const [k, v] of anon) if (v < now - 300000) anon.delete(k);

  const payload = verifyJwt((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  if (payload && payload.jti) {
    const session = db.prepare('SELECT * FROM sessions WHERE jti = ? AND revoked = 0').get(payload.jti);
    if (session) {
      db.prepare(`UPDATE sessions SET last_seen = datetime('now') WHERE jti = ?`).run(payload.jti);
      db.prepare('INSERT INTO accesses (path, ip) VALUES (?, ?)').run(path, ip);
      return res.json({ ok: true, authenticated: true });
    }
  }
  anon.set(ip, now);
  db.prepare('INSERT INTO accesses (path, ip) VALUES (?, ?)').run(path, ip);
  res.json({ ok: true, authenticated: false });
});

router.get('/heartbeat/count', (req, res) => {
  const now = Date.now();
  for (const [k, v] of anon) if (v < now - 300000) anon.delete(k);
  const authed = db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE revoked = 0 AND last_seen > datetime('now', '-5 minutes')`).get().n;
  res.json({ active: authed + anon.size, anonymous: anon.size, authenticated: authed });
});

module.exports = router;
