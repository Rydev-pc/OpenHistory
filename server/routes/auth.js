const express = require('express');
const rateLimit = require('../lib/ratelimit');
const { hashPassword, verifyPassword, signJwt, randomToken } = require('../lib/auth');
const { requireAuth, requireRole, audit, clientIp } = require('../lib/middleware');
const { broadcast } = require('../lib/sse');
const db = require('../db');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, provider: u.provider, created_at: u.created_at, last_login_at: u.last_login_at, last_ip: u.last_ip, last_device: u.last_device };
}

function createSession(res, user, req) {
  const jti = randomToken();
  const token = signJwt({ sub: user.id, jti, role: user.role });
  db.prepare(`INSERT INTO sessions (user_id, jti, device, ip) VALUES (?, ?, ?, ?)`)
    .run(user.id, jti, (req.headers['user-agent'] || '').slice(0, 200), clientIp(req));
  return token;
}

router.post('/login', rateLimit({ windowMs: 60000, max: 10 }), (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    audit({ actor: null, action: 'login.failed', entity: 'users', oldValue: { email }, ip: clientIp(req) });
    return res.status(401).json({ error: 'Credenciais invalidas' });
  }
  if (user.status !== 'active') return res.status(403).json({ error: 'Conta bloqueada. Fale com um administrador.' });
  db.prepare(`UPDATE users SET last_login_at = datetime('now'), last_ip = ?, last_device = ? WHERE id = ?`)
    .run(clientIp(req), (req.headers['user-agent'] || '').slice(0, 200), user.id);
  const token = createSession(res, user, req);
  audit({ actor: { id: user.id, email: user.email }, action: 'login.success', entity: 'sessions', ip: clientIp(req) });
  res.json({ token, user: publicUser(user) });
});

router.post('/logout', requireAuth, (req, res) => {
  db.prepare('UPDATE sessions SET revoked = 1 WHERE jti = ?').run(req.user.jti || '');
  audit({ actor: req.user, action: 'logout', entity: 'sessions' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

router.post('/reset-link', requireAuth, requireRole('admin'), rateLimit({ max: 20 }), (req, res) => {
  const id = Number(req.body.user_id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });
  const token = randomToken();
  db.prepare(`UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?`)
    .run(token, Date.now() + 1000 * 60 * 60, user.id);
  audit({ actor: req.user, action: 'password.reset_link', entity: 'users', entityId: user.id, ip: clientIp(req) });
  res.json({ link: `/resetar-senha?token=${token}` });
});

router.post('/reset-password', rateLimit({ max: 20 }), (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  if (password.length < 8) return res.status(400).json({ error: 'A senha deve ter ao menos 8 caracteres' });
  const user = db.prepare('SELECT * FROM users WHERE reset_token = ? AND reset_expires > ?').get(token, Date.now());
  if (!user) return res.status(400).json({ error: 'Link invalido ou expirado' });
  db.prepare(`UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?`)
    .run(hashPassword(password), user.id);
  db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(user.id);
  audit({ actor: { id: user.id, email: user.email }, action: 'password.reset_done', entity: 'users' });
  res.json({ ok: true });
});

router.post('/invite', requireAuth, requireRole('admin'), (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const role = ['admin', 'editor', 'viewer'].includes(req.body.role) ? req.body.role : 'viewer';
  if (!email) return res.status(400).json({ error: 'Informe o e-mail' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Ja existe usuario com este e-mail' });
  }
  const invite = randomToken();
  const info = db.prepare(`INSERT INTO users (email, role, invite_token) VALUES (?, ?, ?)`).run(email, role, invite);
  audit({ actor: req.user, action: 'user.invited', entity: 'users', entityId: info.lastInsertRowid, newValue: { email, role }, ip: clientIp(req) });
  broadcast('users', { reason: 'invited', email });
  res.status(201).json({ id: info.lastInsertRowid, link: `/aceitar-convite?token=${invite}` });
});

router.post('/complete-invite', rateLimit({ max: 20 }), (req, res) => {
  const token = String(req.body.token || '');
  const name = String(req.body.name || '').trim();
  const password = String(req.body.password || '');
  if (!name || password.length < 8) return res.status(400).json({ error: 'Informe nome e uma senha com 8+ caracteres' });
  const user = db.prepare('SELECT * FROM users WHERE invite_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'Convite invalido' });
  db.prepare(`UPDATE users SET name = ?, password_hash = ?, invite_token = NULL, provider = 'email' WHERE id = ?`)
    .run(name, hashPassword(password), user.id);
  audit({ actor: { id: user.id, email: user.email }, action: 'user.invite_accepted', entity: 'users' });
  res.json({ ok: true });
});

module.exports = router;
