import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { simulate, health } from '../../api/simulator';
import { getMetricsReport } from '../../api/telemetry';
import PageHeader from '../shared/PageHeader';

export default function WhatIfSimulator() {
  const [currentFootprint, setCurrentFootprint] = useState(1000);
  const [energyMixShift, setEnergyMixShift] = useState(20);
  const [efficiencyGain, setEfficiencyGain] = useState(10);

  const mutation = useMutation({
    mutationFn: () =>
      simulate({
        current_footprint: currentFootprint,
        energy_mix_shift: energyMixShift,
        efficiency_gain: efficiencyGain,
      }),
  });

  const healthQuery = useQuery({
    queryKey: ['simulator-health'],
    queryFn: health,
    retry: 1,
    refetchInterval: 30_000,
  });

  // Contextual telemetry data - auto-populate from real metrics
  const telemetryQuery = useQuery({
    queryKey: ['telemetry-metrics'],
    queryFn: getMetricsReport,
    retry: 1,
    refetchInterval: 60_000,
  });

  // Auto-populate current footprint from telemetry carbon data
  useEffect(() => {
    if (telemetryQuery.data?.carbon?.length > 0) {
      const totalCarbon = telemetryQuery.data.carbon.reduce((sum, m) => sum + (m.value || 0), 0);
      if (totalCarbon > 0 && currentFootprint === 1000) {
        // Only update if user hasn't manually changed from default
        setCurrentFootprint(Math.round(totalCarbon / 1000)); // Convert kg to metric tons
      }
    }
  }, [telemetryQuery.data, currentFootprint]);

  const carbonMetrics = telemetryQuery.data?.carbon || [];
  const totalCarbonKg = carbonMetrics.reduce((sum, m) => sum + (m.value || 0), 0);
  const efficiencyMetrics = telemetryQuery.data?.efficiency || [];
  const currentPUE = efficiencyMetrics.find((m) => m.metric_type === 'pue')?.value || null;

  const projectedFootprint = mutation.data?.projected_footprint ?? null;
  const unit = mutation.data?.unit ?? 'metric_tons_CO2e';
  const currentVal = Number(currentFootprint) || 0;
  const projectedVal = projectedFootprint ?? currentVal;

  const chartData = useMemo(() => {
    return [
      { name: 'Current footprint', value: currentVal, fill: '#2d5a4a' },
      { name: 'Projected footprint', value: projectedVal, fill: '#c4952e' },
    ];
  }, [currentVal, projectedVal]);

  const runSimulation = () => {
    mutation.mutate();
  };

  return (
    <section className="space-y-8">
      <PageHeader
        title="What-If Simulator"
        description="Adjust energy mix and efficiency. Compare current vs projected footprint."
        status={healthQuery.isError ? 'error' : 'success'}
        isLoading={healthQuery.isLoading}
      />

      {/* Contextual Info */}
      <div className="card p-4 bg-esg-mint/10 border-l-4 border-esg-sage">
        <p className="text-sm text-esg-sage/90 mb-3">
          <strong className="text-esg-forest">Tip:</strong> Current footprint is auto-populated from your telemetry data.{' '}
          <Link to="/telemetry" className="text-esg-sage hover:underline font-medium">
            View telemetry →
          </Link>
        </p>
        
        {/* Contextual Telemetry Display */}
        {(totalCarbonKg > 0 || currentPUE != null) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-esg-sage/20">
            {totalCarbonKg > 0 && (
              <div className="text-sm">
                <span className="text-esg-forest font-medium">Current Carbon:</span>{' '}
                <span className="text-esg-sage">{(totalCarbonKg / 1000).toFixed(2)} metric tons CO₂e</span>
              </div>
            )}
            {currentPUE != null && (
              <div className="text-sm">
                <span className="text-esg-forest font-medium">Current PUE:</span>{' '}
                <span className={currentPUE > 2.0 ? 'text-esg-alert' : 'text-esg-sage'}>
                  {currentPUE.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sliders */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-esg-forest mb-2">
                Current footprint (metric tons CO₂e)
              </label>
              <input
                type="number"
                value={currentFootprint}
                onChange={(e) => setCurrentFootprint(Number(e.target.value) || 0)}
                min={0}
                step={10}
                className="input-field max-w-xs"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-esg-forest mb-2">
                Energy mix shift (% renewables): {energyMixShift}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={energyMixShift}
                onChange={(e) => setEnergyMixShift(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none bg-esg-mint/30 accent-esg-sage"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-esg-forest mb-2">
                Efficiency gain (%): {efficiencyGain}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={efficiencyGain}
                onChange={(e) => setEfficiencyGain(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none bg-esg-mint/30 accent-esg-sage"
              />
            </div>
            <button
              type="button"
              onClick={runSimulation}
              disabled={mutation.isPending || healthQuery.isError}
              className="btn-primary"
            >
              {mutation.isPending ? 'Running…' : 'Run simulation'}
            </button>
            {mutation.isError && (
              <p className="text-sm text-esg-alert">
                {mutation.error?.message || 'Simulation failed. Check that the simulator service is running.'}
              </p>
            )}
            {projectedFootprint != null && (
              <div className="rounded-lg bg-esg-success/10 border border-esg-success/30 px-4 py-2">
                <p className="text-esg-success font-semibold">
                  Projected: {projectedFootprint} {unit}
                </p>
                <p className="text-sm text-esg-forest mt-0.5">
                  Based on {energyMixShift}% renewables shift and {efficiencyGain}% efficiency gain.
                </p>
              </div>
            )}
          </div>

          {/* Bar chart: current vs projected */}
          <div className="min-h-[280px]">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#7eb89a40" />
                <XAxis dataKey="name" tick={{ fill: '#0d3b2e', fontSize: 12 }} />
                <YAxis tick={{ fill: '#0d3b2e' }} unit=" t" />
                <Tooltip
                  formatter={(value) => [value != null ? value.toFixed(1) : '', 'CO₂e (t)']}
                  contentStyle={{ backgroundColor: '#f5f0e8', border: '1px solid #7eb89a' }}
                />
                <Legend />
                <Bar dataKey="value" name="CO₂e (metric tons)" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
