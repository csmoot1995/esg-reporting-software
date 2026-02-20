import { useState, useMemo, useEffect, useCallback } from 'react';
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
  ReferenceLine,
  LabelList,
} from 'recharts';
import { simulate, health } from '../../api/simulator';
import { getMetricsReport } from '../../api/telemetry';
import PageHeader from '../shared/PageHeader';
import { Zap, Wind, TrendingDown, RefreshCw, Leaf, Target, Info, Play } from 'lucide-react';

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

  // Real-time preview calculation (without API call)
  const liveProjected = useMemo(() => {
    const renewableFactor = 1 - (energyMixShift / 100) * 0.6; // Up to 60% reduction from renewables
    const efficiencyFactor = 1 - (efficiencyGain / 100) * 0.4; // Up to 40% reduction from efficiency
    return Math.round(currentVal * renewableFactor * efficiencyFactor);
  }, [currentVal, energyMixShift, efficiencyGain]);

  const co2Reduction = currentVal - (projectedFootprint ?? liveProjected);
  const reductionPercent = currentVal > 0 ? ((co2Reduction / currentVal) * 100).toFixed(1) : 0;

  const chartData = useMemo(() => {
    return [
      { name: 'Current', value: currentVal, fill: '#2d5a4a', type: 'baseline' },
      { name: 'Projected', value: projectedFootprint ?? liveProjected, fill: '#22c55e', type: 'improved' },
    ];
  }, [currentVal, projectedFootprint, liveProjected]);

  // Preset scenarios
  const scenarios = [
    { name: 'Conservative', energy: 15, efficiency: 10, icon: <Target className="w-4 h-4" /> },
    { name: 'Moderate', energy: 35, efficiency: 20, icon: <Leaf className="w-4 h-4" /> },
    { name: 'Aggressive', energy: 60, efficiency: 35, icon: <Wind className="w-4 h-4" /> },
    { name: 'Net Zero Path', energy: 85, efficiency: 45, icon: <Zap className="w-4 h-4" /> },
  ];

  const applyScenario = useCallback((scenario) => {
    setEnergyMixShift(scenario.energy);
    setEfficiencyGain(scenario.efficiency);
  }, []);

  const runSimulation = useCallback(() => {
    mutation.mutate();
  }, [mutation]);

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

      {/* Scenario Presets */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-esg-sage" />
          <h3 className="font-display font-semibold text-esg-forest">Quick Scenarios</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.name}
              onClick={() => applyScenario(scenario)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-esg-mint/20 hover:bg-esg-mint/40 
                         text-esg-forest text-sm font-medium transition-all hover:scale-105 active:scale-95"
            >
              {scenario.icon}
              <span>{scenario.name}</span>
              <span className="text-xs text-esg-sage/70">
                {scenario.energy}%/{scenario.efficiency}%
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Interactive Controls */}
          <div className="space-y-6">
            {/* Current Footprint with Visual Indicator */}
            <div className="bg-esg-mint/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-esg-forest">
                  <TrendingDown className="w-4 h-4" />
                  Current Footprint
                </label>
                <span className="text-2xl font-bold text-esg-forest">
                  {currentVal.toLocaleString()}
                  <span className="text-sm font-normal text-esg-sage ml-1">t CO₂e</span>
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={10000}
                step={50}
                value={currentFootprint}
                onChange={(e) => setCurrentFootprint(Number(e.target.value))}
                className="w-full h-3 rounded-full appearance-none bg-esg-mint/30 accent-esg-sage cursor-pointer"
              />
              <div className="flex justify-between text-xs text-esg-sage/60 mt-1">
                <span>100 t</span>
                <span>10,000 t</span>
              </div>
            </div>

            {/* Energy Mix Slider with Gradient Track */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-esg-forest">
                  <Wind className="w-4 h-4 text-sky-500" />
                  Renewable Energy Mix
                </label>
                <span className="text-lg font-semibold text-sky-600">{energyMixShift}%</span>
              </div>
              <div className="relative">
                <div 
                  className="absolute h-3 rounded-full bg-gradient-to-r from-orange-400 via-yellow-400 to-green-500"
                  style={{ width: '100%' }}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={energyMixShift}
                  onChange={(e) => setEnergyMixShift(Number(e.target.value))}
                  className="relative w-full h-3 rounded-full appearance-none cursor-pointer bg-transparent z-10"
                  style={{
                    WebkitAppearance: 'none',
                    background: `linear-gradient(to right, #22c55e 0%, #22c55e ${energyMixShift}%, transparent ${energyMixShift}%, transparent 100%)`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-esg-sage/60 mt-1">
                <span>0% Fossil</span>
                <span>100% Renewable</span>
              </div>
            </div>

            {/* Efficiency Gain Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-esg-forest">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Efficiency Improvement
                </label>
                <span className="text-lg font-semibold text-amber-600">{efficiencyGain}%</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={efficiencyGain}
                  onChange={(e) => setEfficiencyGain(Number(e.target.value))}
                  className="w-full h-3 rounded-full appearance-none cursor-pointer"
                  style={{
                    WebkitAppearance: 'none',
                    background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${efficiencyGain}%, #d1fae5 ${efficiencyGain}%, #d1fae5 100%)`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-esg-sage/60 mt-1">
                <span>Baseline</span>
                <span>Max Efficiency</span>
              </div>
            </div>

            {/* Impact Preview Card */}
            <div className={`rounded-xl p-4 transition-all duration-500 ${
              co2Reduction > 0 
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200' 
                : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-esg-sage" />
                <span className="text-sm font-medium text-esg-forest">Live Impact Preview</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-esg-sage/70">Projected Footprint</div>
                  <div className="text-xl font-bold text-esg-forest">
                    {(projectedFootprint ?? liveProjected).toLocaleString()}
                    <span className="text-sm font-normal text-esg-sage ml-1">t</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-esg-sage/70">CO₂ Reduction</div>
                  <div className={`text-xl font-bold ${co2Reduction > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                    {co2Reduction > 0 ? '-' : ''}{co2Reduction.toLocaleString()}
                    <span className="text-sm font-normal ml-1">({reductionPercent}%)</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={runSimulation}
              disabled={mutation.isPending || healthQuery.isError}
              className="btn-primary flex items-center justify-center gap-2 w-full"
            >
              {mutation.isPending ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Running...</>
              ) : (
                <><Play className="w-4 h-4" /> Run Official Simulation</>
              )}
            </button>
            
            {mutation.isError && (
              <p className="text-sm text-esg-alert">
                {mutation.error?.message || 'Simulation failed. Check that the simulator service is running.'}
              </p>
            )}
            
            {projectedFootprint != null && (
              <div className="rounded-lg bg-esg-success/10 border border-esg-success/30 px-4 py-3 animate-in fade-in slide-in-from-top-2">
                <p className="text-esg-success font-semibold flex items-center gap-2">
                  <Leaf className="w-4 h-4" />
                  Confirmed: {projectedFootprint.toLocaleString()} {unit}
                </p>
                <p className="text-sm text-esg-forest mt-1">
                  Based on {energyMixShift}% renewables shift and {efficiencyGain}% efficiency gain.
                </p>
              </div>
            )}
          </div>

          {/* Enhanced Bar Chart */}
          <div className="min-h-[320px] bg-esg-cream/30 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-esg-forest mb-4 text-center">Carbon Footprint Comparison</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#7eb89a30" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#0d3b2e', fontSize: 13, fontWeight: 500 }} 
                  axisLine={{ stroke: '#7eb89a' }}
                />
                <YAxis 
                  tick={{ fill: '#0d3b2e' }} 
                  unit=" t"
                  axisLine={{ stroke: '#7eb89a' }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    value != null ? `${value.toLocaleString()} t CO₂e` : '',
                    name
                  ]}
                  contentStyle={{ 
                    backgroundColor: '#f5f0e8', 
                    border: '2px solid #7eb89a',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <ReferenceLine y={currentVal} stroke="#dc2626" strokeDasharray="5 5" label="Baseline" />
                <Bar dataKey="value" name="CO₂e (metric tons)" radius={[8, 8, 0, 0]} maxBarSize={80}>
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    formatter={(val) => `${val.toLocaleString()}t`}
                    style={{ fill: '#0d3b2e', fontWeight: 600, fontSize: 12 }}
                  />
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={index} 
                      fill={entry.fill}
                      stroke={entry.type === 'improved' ? '#16a34a' : '#1f4538'}
                      strokeWidth={2}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="text-center text-xs text-esg-sage/60 mt-2">
              {co2Reduction > 0 && (
                <span className="text-green-600 font-medium">
                  ↓ {reductionPercent}% reduction potential
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
