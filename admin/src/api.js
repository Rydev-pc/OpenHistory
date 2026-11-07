export const API = '/api';

export function getToken() { return localStorage.getItem('oh_admin_token') || ''; }
export function setSession(token, user) {
  if (token) localStorage.setItem('oh_admin_token', token);
  if (user) localStorage.setItem('oh_admin_user', JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem('oh_admin_token');
  localStorage.removeItem('oh_admin_user');
}
export function currentUser() {
  try { return JSON.parse(localStorage.getItem('oh_admin_user') || 'null'); } catch { return null; }
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(API + path, { ...options, headers });
  } catch {
    throw new Error('Falha de rede — a API está rodando?');
  }
  let data = null;
  try { data = await res.json(); } catch { /* vazio */ }
  if (res.status === 401) {
    clearSession();
    if (onUnauthorized) onUnauthorized();
    throw new Error((data && data.error) || 'Sessão expirada');
  }
  if (!res.ok) {
    const error = new Error((data && data.error) || `Erro ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body: JSON.stringify(body || {}) }),
  put: (p, body) => request(p, { method: 'PUT', body: JSON.stringify(body || {}) }),
  del: (p) => request(p, { method: 'DELETE' }),
};
