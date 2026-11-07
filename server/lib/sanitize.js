const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 'p', 'br', 'ul', 'ol', 'li', 'blockquote', 'code', 'h3', 'h4'];
const ALLOWED_ATTRS = { a: ['href'] };

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHtml(input) {
  let html = String(input || '');
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|input|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|input|link|meta)[^>]*\/?>/gi, '');
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/javascript\s*:/gi, '');
  html = html.replace(/<\/?([a-z0-9]+)((?:\s[^>]*)?)>/gi, (match, tag, attrs) => {
    tag = tag.toLowerCase();
    if (!ALLOWED_TAGS.includes(tag)) return '';
    if (!attrs) return match;
    const kept = attrs.replace(/([a-z-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s]+)/gi, (m, name, value) => {
      name = name.toLowerCase();
      const allowed = ALLOWED_ATTRS[tag] || [];
      if (!allowed.includes(name)) return '';
      if (name === 'href' && /^javascript:/i.test(value)) return '';
      return ` ${name}=${value.replace(/[<>]/g, '')}`;
    });
    return `<${tag}${kept}>`;
  });
  return html;
}

module.exports = { sanitizeHtml, escapeHtml };
