const express = require('express');
const rateLimit = require('../lib/ratelimit');
const { sanitizeHtml, escapeHtml } = require('../lib/sanitize');
const { requireAuth, requireRole, audit, clientIp } = require('../lib/middleware');
const { broadcast } = require('../lib/sse');
const db = require('../db');

const router = express.Router();
router.use(requireAuth);

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setSetting(key, value) {
  db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, JSON.stringify(value));
  broadcast('settings', { key });
}

function str(v, max = 200) { return String(v == null ? '' : v).slice(0, max).trim(); }

// ================= DASHBOARD =================
router.get('/metrics', requireRole('admin', 'editor', 'viewer'), (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const newToday = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now', '-1 day')`).get().n;
  const newWeek = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now', '-7 days')`).get().n;
  const newMonth = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now', '-30 days')`).get().n;
  const totalFacts = db.prepare('SELECT COUNT(*) AS n FROM facts').get().n;
  const totalCuriosities = db.prepare('SELECT COUNT(*) AS n FROM curiosities').get().n;
  const pendingSuggestions = db.prepare(`SELECT COUNT(*) AS n FROM suggestions WHERE status = 'pending'`).get().n;
  const pendingCuriosities = db.prepare(`SELECT COUNT(*) AS n FROM curiosities WHERE status = 'pending'`).get().n;
  const topFacts = db.prepare('SELECT id, title, views FROM facts ORDER BY views DESC LIMIT 5').all();
  const topTerms = db.prepare(`SELECT term, COUNT(*) AS n FROM searches GROUP BY term ORDER BY n DESC LIMIT 8`).all();
  const activeSessions = db.prepare(`SELECT s.id, s.jti, s.device, s.ip, s.created_at, s.last_seen, u.email, u.name, u.role
                                     FROM sessions s JOIN users u ON u.id = s.user_id
                                     WHERE s.revoked = 0 AND s.last_seen > datetime('now', '-5 minutes')
                                     ORDER BY s.last_seen DESC`).all();
  const anonActive = db.prepare(`SELECT COUNT(DISTINCT ip) AS n FROM accesses WHERE created_at > datetime('now', '-5 minutes')`).get().n;

  const goal = getSetting('goal', { month: '', target: 0, raised: 0 });
  const clicksTotal = db.prepare('SELECT COUNT(*) AS n FROM support_clicks').get().n;
  const clicksToday = db.prepare(`SELECT COUNT(*) AS n FROM support_clicks WHERE created_at >= datetime('now', '-1 day')`).get().n;
  const perButton = db.prepare('SELECT label, clicks FROM support_buttons ORDER BY clicks DESC LIMIT 8').all();

  res.json({
    users: { total: totalUsers, newToday, newWeek, newMonth },
    content: { facts: totalFacts, curiosities: totalCuriosities, pendingSuggestions, pendingCuriosities },
    engagement: { topFacts, topTerms },
    presence: { activeSessions, anonymousActive: anonActive },
    support: { goal, clicksTotal, clicksToday, perButton },
  });
});

// séries para gráficos (Recharts)
router.get('/charts/accesses', requireRole('admin', 'editor', 'viewer'), (req, res) => {
  const hours = Number(req.query.hours) || 24;
  const rows = db.prepare(`SELECT strftime('%Y-%m-%d %H:00', created_at) AS bucket, COUNT(*) AS total
                           FROM accesses WHERE created_at >= datetime('now', ?)
                           GROUP BY bucket ORDER BY bucket`).all(`-${hours} hours`);
  const searches = db.prepare(`SELECT strftime('%Y-%m-%d %H:00', created_at) AS bucket, COUNT(*) AS searches
                               FROM searches WHERE created_at >= datetime('now', ?)
                               GROUP BY bucket ORDER BY bucket`).all(`-${hours} hours`);
  const map = new Map();
  for (const r of rows) map.set(r.bucket, { hour: r.bucket.slice(11, 16), accesses: r.total });
  for (const s of searches) {
    const entry = map.get(s.bucket) || { hour: s.bucket.slice(11, 16), accesses: 0 };
    entry.searches = s.searches;
    map.set(s.bucket, entry);
  }
  res.json({ series: [...map.values()] });
});

// ================= USUÁRIOS =================
router.get('/users', requireRole('admin'), (req, res) => {
  const users = db.prepare(`SELECT id, email, name, role, status, provider, created_at, last_login_at, last_ip, last_device FROM users ORDER BY id DESC`).all();
  res.json({ users });
});

router.post('/users', requireRole('admin'), (req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  const name = str(req.body.name, 80);
  const role = ['admin', 'editor', 'viewer'].includes(req.body.role) ? req.body.role : 'viewer';
  const password = str(req.body.password, 100);
  if (!email) return res.status(400).json({ error: 'Informe o e-mail' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'E-mail ja cadastrado' });
  const { hashPassword } = require('../lib/auth');
  const info = db.prepare(`INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)`)
    .run(email, name, role, password ? hashPassword(password) : '');
  audit({ actor: req.user, action: 'user.created', entity: 'users', entityId: info.lastInsertRowid, newValue: { email, name, role }, ip: clientIp(req) });
  broadcast('users', { reason: 'created', email });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/users/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const before = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!before) return res.status(404).json({ error: 'Usuario nao encontrado' });
  const email = str(req.body.email, 120).toLowerCase() || before.email;
  const name = str(req.body.name, 80);
  const role = ['admin', 'editor', 'viewer'].includes(req.body.role) ? req.body.role : before.role;
  const status = ['active', 'blocked'].includes(req.body.status) ? req.body.status : before.status;
  const clash = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
  if (clash) return res.status(409).json({ error: 'E-mail em uso' });
  const wasBlocked = before.status !== 'active';
  db.prepare('UPDATE users SET email = ?, name = ?, role = ?, status = ? WHERE id = ?').run(email, name, role, status, id);
  if (status === 'blocked' && !wasBlocked) {
    db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(id);
  }
  audit({ actor: req.user, action: 'user.updated', entity: 'users', entityId: id, oldValue: { email: before.email, name: before.name, role: before.role, status: before.status }, newValue: { email, name, role, status }, ip: clientIp(req) });
  broadcast('users', { reason: 'updated', email });
  res.json({ ok: true });
});

router.delete('/users/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const before = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!before) return res.status(404).json({ error: 'Usuario nao encontrado' });
  if (id === req.user.id) return res.status(400).json({ error: 'Nao remova a propria conta' });
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  audit({ actor: req.user, action: 'user.deleted', entity: 'users', entityId: id, oldValue: { email: before.email }, ip: clientIp(req) });
  broadcast('users', { reason: 'deleted' });
  res.json({ ok: true });
});

// ================= FATOS / CURIOSIDADES / FONTES =================
function contentRoutes(table) {
  const all = (req, res) => res.json({ items: db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all() });
  const create = (req, res) => {
    const b = req.body;
    const info = db.prepare(`INSERT INTO ${table} (${table === 'facts' ? 'title, short_desc, full_text, source_name, source_url, category, period, image_url, status' : 'title, text, source_name, source_url, status'})
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        sanitizeHtml(str(b.title, 200) || 'Sem titulo'),
        table === 'facts' ? sanitizeHtml(str(b.short_desc, 400)) : sanitizeHtml(str(b.text, 4000)),
        table === 'facts' ? (sanitizeHtml(str(b.full_text, 20000)) || sanitizeHtml(str(b.short_desc, 400))) : sanitizeHtml(str(b.text, 4000)),
        stripTags(str(b.source_name, 120)),
        str(b.source_url, 400),
        table === 'facts' ? str(b.category, 60) || 'Geral' : '',
        table === 'facts' ? str(b.period, 60) : '',
        table === 'facts' ? str(b.image_url, 400) : '',
        ['published', 'draft', 'pending'].includes(b.status) ? b.status : 'published'
      );
    audit({ actor: req.user, action: `${table}.created`, entity: table, entityId: info.lastInsertRowid, newValue: { title: b.title }, ip: clientIp(req) });
    broadcast(table, { reason: 'created' });
    res.status(201).json({ id: info.lastInsertRowid });
  };
  const update = (req, res) => {
    const id = Number(req.params.id);
    const before = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!before) return res.status(404).json({ error: 'Nao encontrado' });
    const b = req.body;
    if (table === 'facts') {
      db.prepare(`UPDATE facts SET title = ?, short_desc = ?, full_text = ?, source_name = ?, source_url = ?, category = ?, period = ?, image_url = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(sanitizeHtml(str(b.title, 200) || before.title), sanitizeHtml(str(b.short_desc, 400)), sanitizeHtml(str(b.full_text, 20000)),
          stripTags(str(b.source_name, 120)), str(b.source_url, 400), str(b.category, 60) || 'Geral', str(b.period, 60), str(b.image_url, 400),
          ['published', 'draft', 'pending'].includes(b.status) ? b.status : before.status, id);
    } else {
      db.prepare(`UPDATE curiosities SET title = ?, text = ?, source_name = ?, source_url = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(sanitizeHtml(str(b.title, 200) || before.title), sanitizeHtml(str(b.text, 4000)), stripTags(str(b.source_name, 120)), str(b.source_url, 400),
          ['published', 'draft', 'pending'].includes(b.status) ? b.status : before.status, id);
    }
    audit({ actor: req.user, action: `${table}.updated`, entity: table, entityId: id, oldValue: { title: before.title }, newValue: { title: b.title }, ip: clientIp(req) });
    broadcast(table, { reason: 'updated', id });
    res.json({ ok: true });
  };
  const remove = (req, res) => {
    const id = Number(req.params.id);
    const before = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!before) return res.status(404).json({ error: 'Nao encontrado' });
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    audit({ actor: req.user, action: `${table}.deleted`, entity: table, entityId: id, oldValue: { title: before.title }, ip: clientIp(req) });
    broadcast(table, { reason: 'deleted', id });
    res.json({ ok: true });
  };
  return { all, create, update, remove };
}

function stripTags(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, '').trim(); }

const factsApi = contentRoutes('facts');
router.get('/facts', factsApi.all);
router.post('/facts', requireRole('admin', 'editor'), factsApi.create);
router.put('/facts/:id', requireRole('admin', 'editor'), factsApi.update);
router.delete('/facts/:id', requireRole('admin'), factsApi.remove);

const curApi = contentRoutes('curiosities');
router.get('/curiosities', curApi.all);
router.post('/curiosities', requireRole('admin', 'editor'), curApi.create);
router.put('/curiosities/:id', requireRole('admin', 'editor'), curApi.update);
router.delete('/curiosities/:id', requireRole('admin'), curApi.remove);

// ---- fontes ----
router.get('/sources', (req, res) => res.json({ sources: db.prepare('SELECT * FROM sources ORDER BY name').all() }));
router.post('/sources', requireRole('admin', 'editor'), (req, res) => {
  const info = db.prepare('INSERT INTO sources (name, url, type, description) VALUES (?, ?, ?, ?)')
    .run(stripTags(str(req.body.name, 120)) || 'Sem nome', str(req.body.url, 400), str(req.body.type, 30) || 'enciclopedia', sanitizeHtml(str(req.body.description, 500)));
  audit({ actor: req.user, action: 'source.created', entity: 'sources', entityId: info.lastInsertRowid });
  broadcast('sources', {});
  res.status(201).json({ id: info.lastInsertRowid });
});
router.put('/sources/:id', requireRole('admin', 'editor'), (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT * FROM sources WHERE id = ?').get(id)) return res.status(404).json({ error: 'Nao encontrada' });
  db.prepare('UPDATE sources SET name = ?, url = ?, type = ?, description = ?, active = ? WHERE id = ?')
    .run(stripTags(str(req.body.name, 120)), str(req.body.url, 400), str(req.body.type, 30) || 'enciclopedia', sanitizeHtml(str(req.body.description, 500)), req.body.active ? 1 : 0, id);
  audit({ actor: req.user, action: 'source.updated', entity: 'sources', entityId: id });
  broadcast('sources', {});
  res.json({ ok: true });
});
router.delete('/sources/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM sources WHERE id = ?').run(Number(req.params.id));
  audit({ actor: req.user, action: 'source.deleted', entity: 'sources', entityId: Number(req.params.id) });
  res.json({ ok: true });
});

// ================= APOIE ESTE CRIADOR =================
router.get('/support', requireRole('admin', 'editor'), (req, res) => {
  res.json({
    buttons: db.prepare('SELECT * FROM support_buttons ORDER BY sort, id').all(),
    messages: db.prepare('SELECT * FROM support_messages ORDER BY created_at DESC').all(),
    clicks: db.prepare('SELECT * FROM support_clicks ORDER BY created_at DESC LIMIT 100').all(),
    creator: getSetting('creator', { name: '', avatar: '', bio: '', message: '' }),
    goal: getSetting('goal', { month: '', target: 0, raised: 0 }),
    supportEnabled: getSetting('supportEnabled', true),
  });
});

router.put('/support/creator', requireRole('admin', 'editor'), (req, res) => {
  const creator = {
    name: str(req.body.name, 80),
    avatar: str(req.body.avatar, 400),
    bio: sanitizeHtml(str(req.body.bio, 800)),
    message: sanitizeHtml(str(req.body.message, 800)),
  };
  setSetting('creator', creator);
  setSetting('supportEnabled', req.body.supportEnabled !== false);
  audit({ actor: req.user, action: 'support.creator_updated', entity: 'app_settings', newValue: creator });
  broadcast('support', { reason: 'creator' });
  res.json({ ok: true, creator });
});

router.put('/support/goal', requireRole('admin', 'editor'), (req, res) => {
  const goal = { month: str(req.body.month, 20), target: Number(req.body.target) || 0, raised: Number(req.body.raised) || 0 };
  setSetting('goal', goal);
  audit({ actor: req.user, action: 'support.goal_updated', entity: 'app_settings', newValue: goal });
  broadcast('support', { reason: 'goal' });
  res.json({ ok: true, goal });
});

router.post('/support/buttons', requireRole('admin', 'editor'), (req, res) => {
  const b = req.body;
  const info = db.prepare(`INSERT INTO support_buttons (label, type, url, pix_key, pix_name, pix_city, amount, sort)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(stripTags(str(b.label, 60)) || 'Apoiar', str(b.type, 30) || 'custom', str(b.url, 400), str(b.pix_key, 200), str(b.pix_name, 60), str(b.pix_city, 40), str(b.amount, 20), Number(b.sort) || 0);
  audit({ actor: req.user, action: 'support.button_created', entity: 'support_buttons', entityId: info.lastInsertRowid });
  broadcast('support', { reason: 'buttons' });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/support/buttons/:id', requireRole('admin', 'editor'), (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT * FROM support_buttons WHERE id = ?').get(id)) return res.status(404).json({ error: 'Nao encontrado' });
  const b = req.body;
  db.prepare(`UPDATE support_buttons SET label = ?, type = ?, url = ?, pix_key = ?, pix_name = ?, pix_city = ?, amount = ?, active = ?, sort = ? WHERE id = ?`)
    .run(stripTags(str(b.label, 60)), str(b.type, 30), str(b.url, 400), str(b.pix_key, 200), str(b.pix_name, 60), str(b.pix_city, 40), str(b.amount, 20), b.active === false ? 0 : 1, Number(b.sort) || 0, id);
  audit({ actor: req.user, action: 'support.button_updated', entity: 'support_buttons', entityId: id });
  broadcast('support', { reason: 'buttons' });
  res.json({ ok: true });
});

router.delete('/support/buttons/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM support_buttons WHERE id = ?').run(Number(req.params.id));
  audit({ actor: req.user, action: 'support.button_deleted', entity: 'support_buttons', entityId: Number(req.params.id) });
  res.json({ ok: true });
});

router.put('/support/messages/:id', requireRole('admin', 'editor'), (req, res) => {
  const id = Number(req.params.id);
  const msg = db.prepare('SELECT * FROM support_messages WHERE id = ?').get(id);
  if (!msg) return res.status(404).json({ error: 'Mensagem nao encontrada' });
  db.prepare('UPDATE support_messages SET visible = ?, response = ? WHERE id = ?')
    .run(req.body.visible ? 1 : 0, sanitizeHtml(str(req.body.response, 500)), id);
  audit({ actor: req.user, action: 'support.message_moderated', entity: 'support_messages', entityId: id, oldValue: { visible: msg.visible }, newValue: { visible: !!req.body.visible } });
  broadcast('support', { reason: 'messages' });
  res.json({ ok: true });
});

router.delete('/support/messages/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM support_messages WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ================= CONFIGURAÇÕES DO APP =================
router.get('/settings', requireRole('admin', 'editor'), (req, res) => {
  res.json({
    home: getSetting('home', {}),
    sections: getSetting('sections', { search: true, curiosities: true, feedback: true, support: true }),
    feedLimit: getSetting('feedLimit', 12),
    randomRotation: getSetting('randomRotation', true),
    categories: getSetting('categories', []),
  });
});

router.put('/settings', requireRole('admin', 'editor'), (req, res) => {
  const b = req.body;
  if (b.home) setSetting('home', { title: str(b.home.title, 80), subtitle: str(b.home.subtitle, 120), welcome: sanitizeHtml(str(b.home.welcome, 400)) });
  if (b.sections) setSetting('sections', {
    search: b.sections.search !== false,
    curiosities: b.sections.curiosities !== false,
    feedback: b.sections.feedback !== false,
    support: b.sections.support !== false,
  });
  if (b.feedLimit != null) setSetting('feedLimit', Math.min(Math.max(Number(b.feedLimit) || 12, 1), 50));
  if (b.randomRotation != null) setSetting('randomRotation', !!b.randomRotation);
  if (Array.isArray(b.categories)) setSetting('categories', b.categories.map(c => stripTags(str(c, 40))).filter(Boolean));
  audit({ actor: req.user, action: 'settings.updated', entity: 'app_settings', newValue: b, ip: clientIp(req) });
  res.json({ ok: true });
});

// ================= FEEDBACK =================
router.get('/suggestions', requireRole('admin', 'editor'), (req, res) => {
  res.json({ suggestions: db.prepare('SELECT * FROM suggestions ORDER BY created_at DESC').all() });
});

router.put('/suggestions/:id', requireRole('admin', 'editor'), (req, res) => {
  const id = Number(req.params.id);
  const s = db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id);
  if (!s) return res.status(404).json({ error: 'Nao encontrada' });
  const status = ['approved', 'rejected', 'answered', 'pending'].includes(req.body.status) ? req.body.status : s.status;
  db.prepare('UPDATE suggestions SET status = ?, response = ? WHERE id = ?').run(status, sanitizeHtml(str(req.body.response, 500)), id);
  audit({ actor: req.user, action: 'suggestion.updated', entity: 'suggestions', entityId: id, oldValue: { status: s.status }, newValue: { status } });
  res.json({ ok: true });
});

// ================= SESSÕES ATIVAS =================
router.get('/sessions', requireRole('admin'), (req, res) => {
  const sessions = db.prepare(`SELECT s.id, s.jti, s.device, s.ip, s.created_at, s.last_seen, u.email FROM sessions s JOIN users u ON u.id = s.user_id
                               WHERE s.revoked = 0 ORDER BY s.last_seen DESC LIMIT 50`).all();
  res.json({ sessions });
});

router.post('/sessions/:jti/revoke', requireRole('admin'), (req, res) => {
  db.prepare('UPDATE sessions SET revoked = 1 WHERE jti = ?').run(String(req.params.jti));
  audit({ actor: req.user, action: 'session.revoked', entity: 'sessions', entityId: req.params.jti });
  broadcast('users', { reason: 'session_revoked' });
  res.json({ ok: true });
});

// ================= AUDITORIA =================
router.get('/audit', requireRole('admin'), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json({
    logs: db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit),
    logins: db.prepare(`SELECT * FROM audit_logs WHERE action LIKE 'login%' ORDER BY id DESC LIMIT 50`).all(),
  });
});

module.exports = router;
