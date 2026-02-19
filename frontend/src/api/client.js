import axios from 'axios';

const client = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Ingestion protocol: errors are { error: { code, message } }; support legacy string error
function errorMessage(data) {
  if (!data) return null;
  const err = data.error;
  if (err && typeof err === 'object' && err.message) return err.message;
  if (typeof err === 'string') return err;
  return data.message ?? null;
}

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = errorMessage(err.response?.data) ?? err.message;
    const status = err.response?.status;
    const e = new Error(message);
    e.status = status;
    e.data = err.response?.data;
    return Promise.reject(e);
  }
);

export default client;
