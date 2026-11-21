const BASE = import.meta.env.VITE_API || '/api';
export async function api(path, { method = 'GET', body } = {}) {
  const t = localStorage.getItem('bg_token');
  const r = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || 'Có lỗi xảy ra, vui lòng thử lại.'); e.data = d; e.status = r.status; throw e; }
  return d;
}
export const qs = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString();
