/**
 * Backend API client. Uses relative /api/ when served with nginx (Docker) or
 * when webpack devServer proxy is used.
 */
const API_BASE = '';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || res.statusText || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  /** GET health for a service (path like /api/alerts/health) */
  async health(service) {
    return request(`/api/${service}/health`, { method: 'GET' });
  },

  /** POST /api/alerts/process-telemetry */
  async processTelemetry(body) {
    return request('/api/alerts/process-telemetry', { method: 'POST', body: JSON.stringify(body) });
  },

  /** POST /api/compliance/validate with X-API-KEY */
  async validateReport(apiKey) {
    return request('/api/compliance/validate', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey },
      body: JSON.stringify({})
    });
  },

  /** POST /api/simulator/simulate */
  async simulate(params) {
    return request('/api/simulator/simulate', {
      method: 'POST',
      body: JSON.stringify({
        current_footprint: Number(params.current_footprint),
        energy_mix_shift: Number(params.energy_mix_shift),
        efficiency_gain: Number(params.efficiency_gain)
      })
    });
  }
};
