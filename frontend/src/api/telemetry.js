import client from './client';

export async function getMetricsReport() {
  return client.get('/api/telemetry/metrics/report');
}

export async function health() {
  return client.get('/api/telemetry/health');
}

export async function ingestTelemetry(payload, options = {}) {
  const { includeScorecard = false, sourceId, ingestionSource, requestId } = options;
  const headers = {};
  
  if (sourceId) headers['X-Source-ID'] = sourceId;
  if (ingestionSource) headers['X-Ingestion-Source'] = ingestionSource;
  if (requestId) headers['X-Request-ID'] = requestId;

  const url = includeScorecard ? '/api/telemetry/ingest?scorecard=1' : '/api/telemetry/ingest';
  
  return client.post(url, payload, { headers });
}
