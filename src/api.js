const B = import.meta.env.VITE_API_URL || '';
export const api = async (path, { method = 'GET', body, token } = {}) => {
  const r = await fetch(B + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Request failed'), { status: r.status });
  return d;
};
export const fmt = d => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const CATS = ['labs', 'diagnoses', 'prescriptions', 'allergies', 'imaging'];
