import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { processTelemetry, health } from '../../api/alerts';
import { getMetricsReport } from '../../api/telemetry';
import PageHeader from '../shared/PageHeader';
import MetricCard from '../shared/MetricCard';

const CO2_MAX = 600;
const TEMP_MAX = 50;

function Gauge({ value, max, unit, label, critical }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className={`rounded-xl border-2 p-4 ${critical ? 'border-esg-alert bg-red-50' : 'border-esg-mint/30 bg-white'}`}>
      <div className="text-sm font-medium text-esg-forest mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-display font-bold ${critical ? 'text-esg-alert' : 'text-esg-sage'}`}>
          {value.toFixed(1)}
        </span>
        <span className="text-esg-sage/80">{unit}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-esg-mint/20 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            critical ? 'bg-esg-alert' : 'bg-esg-sage'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AlertMonitor() {
  const [co2, setCo2] = useState(400);
  const [temp, setTemp] = useState(30);
  const [lastResult, setLastResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [feed, setFeed] = useState([]);
  const [liveInterval, setLiveInterval] = useState(null);

  const healthQuery = useQuery({
    queryKey: ['alerts-health'],
    queryFn: health,
    retry: 1,
    refetchInterval: 30_000,
  });

  // Contextual telemetry data for seamless integration
  const telemetryQuery = useQuery({
    queryKey: ['telemetry-metrics'],
    queryFn: getMetricsReport,
    retry: 1,
    refetchInterval: 30_000,
  });

  const carbonMetrics = telemetryQuery.data?.carbon || [];
  const latestCarbon = carbonMetrics[0]?.value || null;
  const efficiencyMetrics = telemetryQuery.data?.efficiency || [];
  const avgPUE = efficiencyMetrics.find((m) => m.metric_type === 'pue')?.value || null;

  const mutation = useMutation({
    mutationFn: (body) => processTelemetry(body),
    onSuccess: (data) => {
      setLastResult(data);
      if (data.status === 'ALERT_TRIGGERED' && data.details?.some((d) => d.severity === 'CRITICAL')) {
        setToast({ message: 'CRITICAL: Threshold exceeded', details: data.details });
        const t = setTimeout(() => setToast(null), 6000);
        return () => clearTimeout(t);
      }
    },
  });

  const sendTelemetry = useCallback(
    (body) => {
      const payload = { CO2_ppm: body.CO2_ppm ?? co2, Temperature_C: body.Temperature_C ?? temp };
      setFeed((prev) => [
        { time: new Date().toLocaleTimeString(), ...payload, result: null },
        ...prev.slice(0, 19),
      ]);
      mutation.mutate(payload, {
        onSuccess: (data) => {
          setFeed((prev) => {
            const next = [...prev];
            if (next[0]) next[0] = { ...next[0], result: data };
            return next;
          });
        },
      });
    },
    [co2, temp, mutation]
  );

  const isCritical = lastResult?.status === 'ALERT_TRIGGERED';
  const criticalDetails = lastResult?.details ?? [];

  useEffect(() => {
    if (!mutation.isSuccess || lastResult?.status !== 'ALERT_TRIGGERED') return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [lastResult?.status, mutation.isSuccess]);

  const startLiveFeed = () => {
    if (liveInterval) {
      clearInterval(liveInterval);
      setLiveInterval(null);
      return;
    }
    const id = setInterval(() => {
      const CO2_ppm = 350 + Math.random() * 150;
      const Temperature_C = 28 + Math.random() * 12;
      setCo2(CO2_ppm);
      setTemp(Temperature_C);
      processTelemetry({ CO2_ppm, Temperature_C })
        .then((data) => {
          setLastResult(data);
          setFeed((prev) => [
            { time: new Date().toLocaleTimeString(), CO2_ppm, Temperature_C, result: data },
            ...prev.slice(0, 19),
          ]);
          if (data.status === 'ALERT_TRIGGERED' && data.details?.some((d) => d.severity === 'CRITICAL')) {
            setToast({ message: 'CRITICAL: Threshold exceeded', details: data.details });
          }
        })
        .catch(() => {
          setFeed((prev) => [
            { time: new Date().toLocaleTimeString(), CO2_ppm, Temperature_C, result: { status: 'ERROR', error: 'Service unavailable' } },
            ...prev.slice(0, 19),
          ]);
        });
    }, 3000);
    setLiveInterval(id);
  };

  const clearFeed = () => {
    setFeed([]);
    setLastResult(null);
    setToast(null);
  };

  return (
    <section className="space-y-8">
      <PageHeader
        title="Real-Time Alert Monitor"
        description="Live telemetry feed. Gauges and cards turn red on CRITICAL severity."
        status={healthQuery.isError ? 'error' : 'success'}
        isLoading={healthQuery.isLoading}
      />

      {/* Contextual Info */}
      <div className="card p-4 bg-esg-mint/10 border-l-4 border-esg-sage">
        <p className="text-sm text-esg-sage/90 mb-3">
          <strong className="text-esg-forest">Related:</strong> View comprehensive sustainability metrics.{' '}
          <Link to="/telemetry" className="text-esg-sage hover:underline font-medium">
            Open telemetry portal →
          </Link>
        </p>
        
        {/* Contextual Metrics from Telemetry */}
        {(latestCarbon != null || avgPUE != null) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-esg-sage/20">
            {latestCarbon != null && (
              <div className="text-sm">
                <span className="text-esg-forest font-medium">Latest Carbon:</span>{' '}
                <span className="text-esg-sage">{latestCarbon.toFixed(2)} kg CO₂e</span>
              </div>
            )}
            {avgPUE != null && (
              <div className="text-sm">
                <span className="text-esg-forest font-medium">Current PUE:</span>{' '}
                <span className={avgPUE > 2.0 ? 'text-esg-alert' : 'text-esg-sage'}>
                  {avgPUE.toFixed(2)} {avgPUE > 2.0 && '(High)'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast on CRITICAL */}
      {toast && (
        <div className="toast-critical" role="alert">
          <p className="font-semibold text-esg-alert">{toast.message}</p>
          {toast.details?.map((d, i) => (
            <p key={i} className="text-sm mt-1 text-esg-forest">
              {d.metric}: {d.value} (threshold {d.threshold})
            </p>
          ))}
        </div>
      )}

      {/* Gauges + card (red when CRITICAL) */}
      <div className={`card p-6 ${isCritical ? 'card-critical' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Gauge
            value={co2}
            max={CO2_MAX}
            unit="ppm"
            label="CO₂"
            critical={criticalDetails.some((d) => d.metric === 'CO2_ppm')}
          />
          <Gauge
            value={temp}
            max={TEMP_MAX}
            unit="°C"
            label="Temperature"
            critical={criticalDetails.some((d) => d.metric === 'Temperature_C')}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2">
            <span className="text-sm text-esg-forest">CO₂ ppm</span>
            <input
              type="number"
              value={co2}
              onChange={(e) => setCo2(Number(e.target.value))}
              min={0}
              max={CO2_MAX}
              step={1}
              className="input-field w-24"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-esg-forest">Temp °C</span>
            <input
              type="number"
              value={temp}
              onChange={(e) => setTemp(Number(e.target.value))}
              min={0}
              max={TEMP_MAX}
              step={0.1}
              className="input-field w-24"
            />
          </label>
          <button
            type="button"
            onClick={() => sendTelemetry({})}
            disabled={mutation.isPending || healthQuery.isError}
            className="btn-primary"
          >
            Send telemetry
          </button>
          <button
            type="button"
            onClick={startLiveFeed}
            className={liveInterval ? 'btn-secondary border-esg-alert/50 bg-red-50 text-esg-alert hover:bg-red-100' : 'btn-secondary'}
          >
            {liveInterval ? 'Stop live feed' : 'Start live feed'}
          </button>
          {feed.length > 0 && (
            <button type="button" onClick={clearFeed} className="btn-secondary">
              Clear feed
            </button>
          )}
        </div>
        {mutation.isError && (
          <p className="mt-3 text-sm text-esg-alert">
            {mutation.error?.message || 'Failed to send telemetry. Check that the alerts service is running.'}
          </p>
        )}
      </div>

      {/* Live feed list */}
      <div className="card p-6">
        <h3 className="font-display font-semibold text-esg-forest mb-3">Live feed</h3>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {feed.length === 0 && (
            <p className="text-sm text-esg-sage/80">Send telemetry or start live feed to see entries.</p>
          )}
          {feed.map((entry, i) => (
            <div
              key={i}
              className={`flex flex-wrap items-center gap-2 text-sm py-2 px-3 rounded-lg ${
                entry.result?.status === 'ALERT_TRIGGERED'
                  ? 'bg-red-50 border border-esg-alert/30'
                  : entry.result?.status === 'WARNING'
                    ? 'bg-amber-50 border border-amber-300'
                    : 'bg-esg-cream/50'
              }`}
            >
              <span className="text-esg-sage/80">{entry.time}</span>
              <span>CO₂ {entry.CO2_ppm?.toFixed(0)} ppm</span>
              <span>Temp {entry.Temperature_C?.toFixed(1)} °C</span>
              {entry.result && (
                <span
                  className={
                    entry.result.status === 'ALERT_TRIGGERED'
                      ? 'font-medium text-esg-alert'
                      : entry.result.status === 'WARNING'
                        ? 'font-medium text-amber-700'
                        : entry.result.status === 'ERROR'
                          ? 'font-medium text-esg-alert'
                          : 'text-esg-success'
                  }
                >
                  {entry.result.status === 'ERROR' ? (entry.result.error || 'Error') : entry.result.status}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
