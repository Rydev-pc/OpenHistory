export const API = '/api';

export function getToken() {
  return localStorage.getItem('oh_token') || '';
}

export function setToken(token) {
  if (token) localStorage.setItem('oh_token', token);
  else localStorage.removeItem('oh_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch { /* vazio */ }
  if (!res.ok) {
    const error = new Error((data && data.error) || `Erro ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  get: (p, opts) => request(p, { ...opts, method: 'GET' }),
  post: (p, body, opts) => request(p, { ...opts, method: 'POST', body: JSON.stringify(body || {}) }),
  put: (p, body, opts) => request(p, { ...opts, method: 'PUT', body: JSON.stringify(body || {}) }),
  del: (p, opts) => request(p, { ...opts, method: 'DELETE' }),
};
