const db = require('../db');
const { verifyJwt } = require('./auth');
const { broadcast } = require('./sse');

function audit({ actor, action, entity = '', entityId = null, oldValue = null, newValue = null, ip = '' }) {
  try {
    db.prepare(`INSERT INTO audit_logs (actor_id, actor_email, action, entity, entity_id, old_value, new_value, ip)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      actor ? actor.id : null,
      actor ? actor.email : '',
      action,
      entity,
      entityId == null ? null : String(entityId),
      oldValue == null ? null : JSON.stringify(oldValue),
      newValue == null ? null : JSON.stringify(newValue),
      ip
    );
    broadcast('audit', { action, entity, actor: actor ? actor.email : '-' });
  } catch { /* auditoria nunca deve derrubar a requisicao */ }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyJwt(token);
  if (!payload) return res.status(401).json({ error: 'Nao autenticado' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
  if (!user || user.status !== 'active') return res.status(401).json({ error: 'Conta indisponivel' });
  if (payload.jti) {
    const session = db.prepare('SELECT * FROM sessions WHERE jti = ?').get(payload.jti);
    if (!session || session.revoked) return res.status(401).json({ error: 'Sessao encerrada' });
    db.prepare(`UPDATE sessions SET last_seen = datetime('now') WHERE jti = ?`).run(payload.jti);
  }
  req.user = { id: user.id, email: user.email, name: user.name, role: user.role, jti: payload.jti };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Nao autenticado' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Sem permissao' });
    next();
  };
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
}

module.exports = { requireAuth, requireRole, audit, clientIp };
