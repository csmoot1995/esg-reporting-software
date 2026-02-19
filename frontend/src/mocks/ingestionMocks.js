/**
 * Mock JSON payloads for testing ingestion across verticals and AI data center types.
 * Each mock is valid per schema and exercises different blocks/features.
 */

const now = () => new Date().toISOString();
const uniqueId = () => `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const SUSTAINABILITY_MOCKS = [
  {
    id: 'ai-training-full',
    name: 'AI Training Data Center',
    description: 'Full stack: energy, carbon, water, compute (training), hardware, data quality. Use for GPU training facilities.',
    vertical: 'AI Training',
    payload: () => ({
      timestamp: now(),
      asset_id: 'DC1-TRAIN-A01',
      region: 'us-west-2',
      source_id: 'mock-gateway',
      external_event_id: uniqueId(),
      emission_factor_version: 'v1',
      energy: {
        facility_kwh: 2400.0,
        it_kwh: 2000.0,
        cooling_kwh: 360.0,
        generator_fuel_liters: 0,
        energy_unit: 'kWh',
      },
      carbon: {
        scope1_kg_co2e: 0,
        scope2_location_kg_co2e: 480.0,
        scope2_market_kg_co2e: 420.0,
        grid_carbon_intensity_kg_per_kwh: 0.24,
        carbon_unit: 'kg_co2e',
      },
      water: {
        withdrawal_liters: 12000.0,
        returned_liters: 9600.0,
        consumed_liters: 2400.0,
        reclaimed_liters: 2400.0,
        evaporation_liters: 1800.0,
        blowdown_liters: 600.0,
        water_unit: 'liters',
      },
      compute: {
        gpu_hours: 400.0,
        gpu_count: 200,
        run_duration_seconds: 14400,
        run_type: 'training',
        training_runs: 8,
        inference_requests: 0,
      },
      hardware: {
        utilization_pct: 78.0,
        idle_rate_pct: 22.0,
        asset_state: 'active',
      },
      data_quality: {
        completeness_pct: 99.0,
        latency_seconds: 3.0,
        outlier_flag: false,
        drift_flag: false,
        confidence_score: 0.95,
      },
    }),
  },
  {
    id: 'ai-inference-serving',
    name: 'AI Inference / Serving',
    description: 'Energy + compute (inference requests). Use for inference-only or serving clusters.',
    vertical: 'AI Inference',
    payload: () => ({
      timestamp: now(),
      asset_id: 'DC2-INFER-B02',
      region: 'eu-west-1',
      source_id: 'mock-gateway',
      external_event_id: uniqueId(),
      energy: {
        facility_kwh: 800.0,
        it_kwh: 680.0,
        cooling_kwh: 100.0,
        energy_unit: 'kWh',
      },
      compute: {
        gpu_hours: 85.0,
        gpu_count: 50,
        training_runs: 0,
        inference_requests: 125000,
      },
      hardware: {
        utilization_pct: 62.0,
        idle_rate_pct: 38.0,
        asset_state: 'active',
      },
    }),
  },
  {
    id: 'colocation-energy',
    name: 'Colocation — Energy Only',
    description: 'Minimal: energy block only. Use for colo or facilities without water/compute telemetry.',
    vertical: 'Colocation',
    payload: () => ({
      timestamp: now(),
      asset_id: 'COLO-HALL-3',
      region: 'us-east-1',
      external_event_id: uniqueId(),
      energy: {
        facility_kwh: 5000.0,
        it_kwh: 4200.0,
        cooling_kwh: 700.0,
        energy_unit: 'kWh',
      },
    }),
  },
  {
    id: 'water-intensive',
    name: 'Water-Intensive Cooling',
    description: 'Energy + water (tower, blowdown, reclaimed). Use for evaporative cooling sites.',
    vertical: 'Water-Critical',
    payload: () => ({
      timestamp: now(),
      asset_id: 'DC3-WATER-A01',
      region: 'us-southwest',
      external_event_id: uniqueId(),
      energy: {
        facility_kwh: 3000.0,
        it_kwh: 2500.0,
        cooling_kwh: 450.0,
        energy_unit: 'kWh',
      },
      water: {
        withdrawal_liters: 25000.0,
        returned_liters: 20000.0,
        consumed_liters: 5000.0,
        reclaimed_liters: 5000.0,
        evaporation_liters: 3800.0,
        blowdown_liters: 1200.0,
        water_unit: 'liters',
      },
    }),
  },
  {
    id: 'hpc-research',
    name: 'HPC / Research',
    description: 'Energy, compute, hardware. Use for HPC or research compute clusters.',
    vertical: 'HPC',
    payload: () => ({
      timestamp: now(),
      asset_id: 'HPC-CLUSTER-01',
      region: 'us-central',
      external_event_id: uniqueId(),
      energy: {
        facility_kwh: 6000.0,
        it_kwh: 5200.0,
        cooling_kwh: 720.0,
        energy_unit: 'kWh',
      },
      compute: {
        gpu_hours: 1200.0,
        gpu_count: 400,
        run_duration_seconds: 43200,
        run_type: 'training',
        training_runs: 24,
        inference_requests: 0,
      },
      hardware: {
        utilization_pct: 88.0,
        idle_rate_pct: 12.0,
        asset_state: 'active',
      },
    }),
  },
  {
    id: 'edge-minimal',
    name: 'Edge / Minimal',
    description: 'Minimal energy + compute. Use for edge or small sites with limited sensors.',
    vertical: 'Edge',
    payload: () => ({
      timestamp: now(),
      asset_id: 'EDGE-01',
      region: 'on-prem',
      external_event_id: uniqueId(),
      energy: {
        facility_kwh: 120.0,
        it_kwh: 100.0,
        cooling_kwh: 18.0,
        energy_unit: 'kWh',
      },
      compute: {
        gpu_hours: 12.0,
        gpu_count: 4,
        training_runs: 0,
        inference_requests: 500,
      },
    }),
  },
  {
    id: 'full-benchmark',
    name: 'Full Benchmark (All Blocks)',
    description: 'All blocks populated — carbon, water, energy, compute, hardware, data_quality. Schema reference.',
    vertical: 'Reference',
    payload: () => ({
      timestamp: now(),
      asset_id: 'DC1-RACK-A01',
      region: 'us-west',
      source_id: 'gateway-01',
      external_event_id: uniqueId(),
      emission_factor_version: 'v1',
      energy: {
        facility_kwh: 1200.0,
        it_kwh: 1000.0,
        cooling_kwh: 180.0,
        generator_fuel_liters: 0,
        energy_unit: 'kWh',
      },
      water: {
        withdrawal_liters: 8000.0,
        returned_liters: 6400.0,
        consumed_liters: 1600.0,
        reclaimed_liters: 1600.0,
        evaporation_liters: 1200.0,
        blowdown_liters: 400.0,
        water_unit: 'liters',
      },
      compute: {
        gpu_hours: 200.0,
        gpu_count: 100,
        run_duration_seconds: 7200,
        run_type: 'training',
        training_runs: 4,
        inference_requests: 0,
      },
      hardware: {
        utilization_pct: 75.0,
        idle_rate_pct: 25.0,
        asset_state: 'active',
      },
      data_quality: {
        completeness_pct: 98.0,
        latency_seconds: 5.0,
        outlier_flag: false,
        drift_flag: false,
        confidence_score: 0.92,
      },
    }),
  },
  {
    id: 'carbon-intensive',
    name: 'Carbon-Intensive Region',
    description: 'Carbon block + energy. Use to test Scope 1/2 and grid intensity handling.',
    vertical: 'Carbon-Focused',
    payload: () => ({
      timestamp: now(),
      asset_id: 'DC-HIGH-CARBON',
      region: 'high-grid-intensity',
      external_event_id: uniqueId(),
      energy: {
        facility_kwh: 1500.0,
        it_kwh: 1250.0,
        cooling_kwh: 220.0,
        energy_unit: 'kWh',
      },
      carbon: {
        scope1_kg_co2e: 50.0,
        scope2_location_kg_co2e: 600.0,
        scope2_market_kg_co2e: 500.0,
        grid_carbon_intensity_kg_per_kwh: 0.48,
        carbon_unit: 'kg_co2e',
      },
    }),
  },
  {
    id: 'data-quality-focus',
    name: 'Data Quality Focus',
    description: 'Compute + hardware + data_quality. Use to test confidence and outlier/drift flags.',
    vertical: 'Data Quality',
    payload: () => ({
      timestamp: now(),
      asset_id: 'DC-QUALITY-01',
      region: 'us-west',
      external_event_id: uniqueId(),
      compute: {
        gpu_hours: 100.0,
        gpu_count: 50,
        training_runs: 2,
        inference_requests: 10000,
      },
      hardware: {
        utilization_pct: 70.0,
        idle_rate_pct: 30.0,
        asset_state: 'active',
      },
      data_quality: {
        completeness_pct: 95.0,
        latency_seconds: 8.0,
        outlier_flag: false,
        drift_flag: true,
        confidence_score: 0.85,
      },
    }),
  },
];

export const LEGACY_MOCKS = [
  {
    id: 'legacy-normal',
    name: 'Legacy — Normal',
    description: 'CO₂ and temperature within safe range. Expect NORMAL status.',
    vertical: 'Alerts',
    payload: () => ({
      CO2_ppm: 420,
      Temperature_C: 28.5,
    }),
  },
  {
    id: 'legacy-warning',
    name: 'Legacy — Warning',
    description: 'One or both metrics near threshold. May return WARNING.',
    vertical: 'Alerts',
    payload: () => ({
      CO2_ppm: 550,
      Temperature_C: 38.0,
    }),
  },
  {
    id: 'legacy-critical',
    name: 'Legacy — Critical',
    description: 'Exceeds critical thresholds. Expect ALERT_TRIGGERED.',
    vertical: 'Alerts',
    payload: () => ({
      CO2_ppm: 650,
      Temperature_C: 48.0,
    }),
  },
];

export function getMockPayload(mock) {
  return typeof mock.payload === 'function' ? mock.payload() : mock.payload;
}

export function getMockPayloadJson(mock, pretty = true) {
  const payload = getMockPayload(mock);
  return JSON.stringify(payload, null, pretty ? 2 : 0);
}
