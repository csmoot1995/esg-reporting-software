import client from './client';

export async function simulate({ current_footprint, energy_mix_shift, efficiency_gain }) {
  return client.post('/api/simulator/simulate', {
    current_footprint: Number(current_footprint),
    energy_mix_shift: Number(energy_mix_shift),
    efficiency_gain: Number(efficiency_gain),
  });
}

export async function health() {
  return client.get('/api/simulator/health');
}
