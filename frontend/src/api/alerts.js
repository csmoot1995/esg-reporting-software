import client from './client';

export async function processTelemetry(body) {
  return client.post('/api/alerts/process-telemetry', body);
}

export async function health() {
  return client.get('/api/alerts/health');
}
