import client from './client';

export async function validateReport(apiKey) {
  return client.post('/api/compliance/validate', {}, {
    headers: { 'X-API-KEY': apiKey },
  });
}

export async function health() {
  return client.get('/api/compliance/health');
}
