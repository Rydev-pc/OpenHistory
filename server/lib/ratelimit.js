const buckets = new Map();

function rateLimit({ windowMs = 60000, max = 30 } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    let entry = buckets.get(key);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      buckets.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ error: 'Muitas requisicoes. Tente novamente em alguns instantes.' });
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
}, 60000).unref();

module.exports = rateLimit;
