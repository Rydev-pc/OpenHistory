require('./db');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const { sseHandler } = require('./lib/sse');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'Open History', time: new Date().toISOString() }));
app.get('/api/stream', sseHandler);

app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

// serve os builds do app e do painel quando disponíveis
const appDist = path.join(__dirname, '..', 'app', 'dist');
const adminDist = path.join(__dirname, '..', 'admin', 'dist');
if (fs.existsSync(appDist)) {
  app.use('/admin', express.static(adminDist));
  app.get(/^\/admin(\/.*)?$/, (req, res) => res.sendFile(path.join(adminDist, 'index.html')));
  app.use(express.static(appDist));
  app.get('*', (req, res) => res.sendFile(path.join(appDist, 'index.html')));
} else {
  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota nao encontrada' }));
}

app.use((err, req, res, next) => {
  console.error('[erro]', err.message);
  res.status(500).json({ error: 'Erro interno' });
});

app.listen(PORT, () => {
  console.log(`Open History API em http://localhost:${PORT}`);
  const count = require('./db').prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count === 0) console.log('Banco vazio — execute "npm run seed" para dados iniciais.');
});
