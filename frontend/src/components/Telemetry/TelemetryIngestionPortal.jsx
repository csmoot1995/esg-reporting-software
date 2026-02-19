import { useState, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ingestTelemetry, health, getMetricsReport } from '../../api/telemetry';
import { processTelemetry } from '../../api/alerts';
import PageHeader from '../shared/PageHeader';
import MetricCard from '../shared/MetricCard';
import { SUSTAINABILITY_MOCKS, LEGACY_MOCKS, getMockPayloadJson } from '../../mocks/ingestionMocks';

const CUSTOM_MOCKS_STORAGE_KEY = 'esg-ingestion-custom-mocks';
const ACTIVE_TAB_STORAGE_KEY = 'esg-telemetry-active-tab';

// Utility: Format metric names for display
function formatMetricName(metricType) {
  return metricType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/Kg Co2e/g, 'kg CO₂e')
    .replace(/Co2e/g, 'CO₂e')
    .replace(/Pct/g, '%')
    .replace(/Per/g, 'per')
    .replace(/Gpu/g, 'GPU')
    .replace(/Kwh/g, 'kWh')
    .replace(/Liters/g, 'Liters')
    .replace(/Wue/g, 'WUE')
    .replace(/Pue/g, 'PUE')
    .replace(/Dcie/g, 'DCiE');
}

// Dashboard Tab: Metrics Section Component
function MetricSection({ title, metrics, emptyMessage = 'No metrics available', criticalCheck }) {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="font-display font-semibold text-esg-forest mb-3">{title}</h3>
        <p className="text-sm text-esg-sage/80">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="font-display font-semibold text-esg-forest mb-4">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, idx) => {
          const isCritical = criticalCheck ? criticalCheck(metric) : false;
          return (
            <MetricCard
              key={idx}
              title={formatMetricName(metric.metric_type)}
              value={metric.value}
              unit={metric.unit}
              subtitle={metric.asset_id ? `Asset: ${metric.asset_id}` : metric.region ? `Region: ${metric.region}` : null}
              critical={isCritical}
            />
          );
        })}
      </div>
    </div>
  );
}

// Dashboard Tab Component
function DashboardTab({ metricsQuery }) {
  const { carbonMetrics, waterMetrics, efficiencyMetrics, hardwareMetrics, dataQualityMetrics, summaryStats } =
    useMemo(() => {
      const data = metricsQuery.data || {};
      return {
        carbonMetrics: data.carbon || [],
        waterMetrics: data.water || [],
        efficiencyMetrics: data.efficiency || [],
        hardwareMetrics: data.hardware || [],
        dataQualityMetrics: data.data_quality || [],
        summaryStats: {
          totalCarbon: data.carbon?.reduce((sum, m) => sum + (m.value || 0), 0) || 0,
          totalWater: data.water?.reduce((sum, m) => sum + (m.value || 0), 0) || 0,
          avgPUE: data.efficiency?.find((m) => m.metric_type === 'pue')?.value || null,
          avgUtilization: data.hardware?.find((m) => m.metric_type === 'utilization_pct')?.value || null,
          latestCarbonIntensity: data.carbon?.find((m) => m.metric_type === 'carbon_intensity') || null,
          sustainabilityScore: data.sustainability_score || null,
        },
      };
    }, [metricsQuery.data]);

  const latestTimestamp = useMemo(() => {
    const allMetrics = [...carbonMetrics, ...waterMetrics, ...efficiencyMetrics, ...hardwareMetrics, ...dataQualityMetrics];
    if (allMetrics.length === 0) return null;
    const timestamps = allMetrics.map((m) => m.timestamp_utc).filter(Boolean);
    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps.map((t) => new Date(t).getTime())));
  }, [carbonMetrics, waterMetrics, efficiencyMetrics, hardwareMetrics, dataQualityMetrics]);

  // Critical checks for metrics
  const isCritical = (metric) =>
    (metric.metric_type === 'pue' && metric.value > 2.0) ||
    (metric.metric_type === 'utilization_pct' && metric.value < 30) ||
    (metric.metric_type === 'wue' && metric.value > 2.0);

  const hasAnyMetrics = carbonMetrics.length > 0 || waterMetrics.length > 0 || 
                        efficiencyMetrics.length > 0 || hardwareMetrics.length > 0 ||
                        dataQualityMetrics.length > 0 || summaryStats.sustainabilityScore != null;

  return (
    <div className="space-y-8">
      {/* Summary Stats */}
      {(hasAnyMetrics) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {summaryStats.sustainabilityScore != null && (
            <MetricCard
              title="Sustainability Score"
              value={summaryStats.sustainabilityScore}
              unit="/100"
              subtitle="Overall performance"
              className="border-l-4 border-esg-success"
            />
          )}
          {summaryStats.avgPUE != null && (
            <MetricCard
              title="Average PUE"
              value={summaryStats.avgPUE}
              unit=""
              subtitle="Power Usage Effectiveness"
              critical={summaryStats.avgPUE > 2.0}
            />
          )}
          {summaryStats.avgUtilization != null && (
            <MetricCard
              title="Average Utilization"
              value={summaryStats.avgUtilization}
              unit="%"
              subtitle="Hardware utilization"
              critical={summaryStats.avgUtilization < 30}
            />
          )}
          {summaryStats.totalCarbon > 0 && (
            <MetricCard title="Total Carbon" value={summaryStats.totalCarbon} unit="kg CO₂e" subtitle="Cumulative" />
          )}
          {summaryStats.latestCarbonIntensity && (
            <MetricCard
              title="Carbon Intensity"
              value={summaryStats.latestCarbonIntensity.value}
              unit={summaryStats.latestCarbonIntensity.unit}
              subtitle="kg CO₂e per functional unit"
            />
          )}
          {summaryStats.totalWater > 0 && (
            <MetricCard title="Total Water" value={summaryStats.totalWater} unit="L" subtitle="Cumulative" />
          )}
        </div>
      )}

      {/* Contextual Alerts */}
      {((summaryStats.avgPUE != null && summaryStats.avgPUE > 2.0) ||
        (summaryStats.avgUtilization != null && summaryStats.avgUtilization < 30)) && (
        <div className="card p-4 bg-esg-alert/10 border-l-4 border-esg-alert">
          <h4 className="font-semibold text-esg-alert mb-2">Performance Alerts</h4>
          <div className="space-y-2 text-sm">
            {summaryStats.avgPUE != null && summaryStats.avgPUE > 2.0 && (
              <p className="text-esg-forest">
                <span className="text-esg-alert">⚠️</span> High PUE detected ({summaryStats.avgPUE.toFixed(2)}). 
                Consider reviewing cooling efficiency.
              </p>
            )}
            {summaryStats.avgUtilization != null && summaryStats.avgUtilization < 30 && (
              <p className="text-esg-forest">
                <span className="text-esg-alert">⚠️</span> Low hardware utilization ({summaryStats.avgUtilization.toFixed(1)}%). 
                Review workload distribution.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Last Update */}
      {latestTimestamp && (
        <div className="text-sm text-esg-sage/80">
          Last update: {latestTimestamp.toLocaleString()}
        </div>
      )}

      {/* Metric Sections */}
      <MetricSection
        title="Carbon Metrics"
        metrics={carbonMetrics}
        emptyMessage="No carbon metrics available. Ingest telemetry with carbon data to see metrics."
        criticalCheck={isCritical}
      />

      <MetricSection
        title="Water Metrics"
        metrics={waterMetrics}
        emptyMessage="No water metrics available. Ingest telemetry with water data to see metrics."
        criticalCheck={isCritical}
      />

      <MetricSection
        title="Efficiency Metrics"
        metrics={efficiencyMetrics}
        emptyMessage="No efficiency metrics available. Ingest telemetry with efficiency data to see metrics."
        criticalCheck={isCritical}
      />

      <MetricSection
        title="Hardware Metrics"
        metrics={hardwareMetrics}
        emptyMessage="No hardware metrics available. Ingest telemetry with hardware data to see metrics."
        criticalCheck={isCritical}
      />

      <MetricSection
        title="Data Quality Metrics"
        metrics={dataQualityMetrics}
        emptyMessage="No data quality metrics available. Ingest telemetry with data quality data to see metrics."
      />

      {metricsQuery.isError && (
        <div className="card p-6 border-esg-alert bg-red-50">
          <p className="text-esg-alert font-medium">
            Failed to load metrics: {metricsQuery.error?.message || 'Unknown error'}
          </p>
          <p className="text-sm text-esg-forest mt-2">
            Make sure the telemetry service is running on port 8083 and has ingested some data.
          </p>
        </div>
      )}

      {metricsQuery.isLoading && (
        <div className="card p-6">
          <p className="text-esg-sage">Loading metrics...</p>
        </div>
      )}
    </div>
  );
}

// Ingestion Tab Component
function IngestionTab({ onIngestSuccess }) {
  const queryClient = useQueryClient();
  const [ingestionType, setIngestionType] = useState('sustainability');
  const [jsonInput, setJsonInput] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [ingestionSource, setIngestionSource] = useState('manual-entry');
  const [includeScorecard, setIncludeScorecard] = useState(false);
  const [customMockName, setCustomMockName] = useState('');
  const fileInputRef = useRef(null);

  const [customMocks, setCustomMocks] = useState(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_MOCKS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_MOCKS_STORAGE_KEY, JSON.stringify(customMocks));
    } catch (e) {
      /* ignore */
    }
  }, [customMocks]);

  const sustainabilityMutation = useMutation({
    mutationFn: (payload) =>
      ingestTelemetry(payload, {
        sourceId: sourceId || undefined,
        ingestionSource: ingestionSource || undefined,
        includeScorecard,
      }),
    onSuccess: (data) => {
      setJsonInput('');
      // Invalidate and refetch metrics
      queryClient.invalidateQueries({ queryKey: ['telemetry-metrics'] });
      onIngestSuccess?.({ type: 'sustainability', data });
    },
  });

  const legacyMutation = useMutation({
    mutationFn: (payload) => processTelemetry(payload),
    onSuccess: (data) => {
      setJsonInput('');
      queryClient.invalidateQueries({ queryKey: ['telemetry-metrics'] });
      onIngestSuccess?.({ type: 'legacy', data });
    },
  });

  const handleLoadExample = () => {
    const mock = ingestionType === 'sustainability' ? SUSTAINABILITY_MOCKS[0] : LEGACY_MOCKS[0];
    setJsonInput(getMockPayloadJson(mock));
  };

  const handleLoadMock = (mock, type) => {
    setIngestionType(type);
    setJsonInput(getMockPayloadJson(mock));
  };

  const handleSaveCustomMock = () => {
    if (!jsonInput.trim() || !customMockName.trim()) return;
    try {
      JSON.parse(jsonInput);
      const newMock = {
        id: `custom-${Date.now()}`,
        name: customMockName.trim(),
        payload: jsonInput.trim(),
        type: ingestionType,
        savedAt: new Date().toISOString(),
      };
      setCustomMocks((prev) => [newMock, ...prev]);
      setCustomMockName('');
    } catch (e) {
      alert('Invalid JSON. Fix payload before saving.');
    }
  };

  const handleDeleteCustomMock = (id) => {
    setCustomMocks((prev) => prev.filter((m) => m.id !== id));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        const parsed = JSON.parse(content);
        setJsonInput(JSON.stringify(parsed, null, 2));
      } catch (error) {
        alert('Invalid JSON file: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    if (!jsonInput.trim()) {
      alert('Please enter JSON payload or load an example');
      return;
    }
    try {
      const payload = JSON.parse(jsonInput);
      if (ingestionType === 'sustainability') {
        if (!payload.timestamp) {
          payload.timestamp = new Date().toISOString();
        }
        sustainabilityMutation.mutate(payload);
      } else {
        legacyMutation.mutate(payload);
      }
    } catch (error) {
      alert('Invalid JSON: ' + error.message);
    }
  };

  const currentMutation = ingestionType === 'sustainability' ? sustainabilityMutation : legacyMutation;

  return (
    <div className="space-y-6">
      {/* Contextual Info */}
      <div className="card p-4 bg-esg-mint/10 border-l-4 border-esg-sage">
        <p className="text-sm text-esg-sage/90">
          <strong className="text-esg-forest">Tip:</strong> Data ingested here will automatically appear in the Dashboard tab. 
          Check <Link to="/alerts" className="text-esg-sage hover:underline font-medium">alerts →</Link> for threshold breaches.
        </p>
      </div>

      {/* Mock Library */}
      <div className="card p-6">
        <h3 className="font-display font-semibold text-esg-forest mb-2">Mock Library</h3>
        <p className="text-sm text-esg-sage/80 mb-4">
          Load preset JSON by vertical and AI data center type to test ingestion.
        </p>

        <div className="mb-6">
          <h4 className="text-sm font-semibold text-esg-forest mb-3">Sustainability telemetry (by vertical)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {SUSTAINABILITY_MOCKS.map((mock) => (
              <div key={mock.id} className="rounded-lg border border-esg-mint/30 bg-white p-4 hover:border-esg-sage/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-esg-forest truncate">{mock.name}</div>
                    <div className="text-xs text-esg-sage/70 mt-0.5">{mock.vertical}</div>
                    <p className="text-xs text-esg-sage/80 mt-2 line-clamp-2">{mock.description}</p>
                  </div>
                  <button type="button" onClick={() => handleLoadMock(mock, 'sustainability')} className="btn-primary text-xs shrink-0">
                    Load
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-sm font-semibold text-esg-forest mb-3">Legacy alerts (CO₂ / temperature)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {LEGACY_MOCKS.map((mock) => (
              <div key={mock.id} className="rounded-lg border border-esg-mint/30 bg-white p-4 hover:border-esg-sage/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-esg-forest">{mock.name}</div>
                    <p className="text-xs text-esg-sage/80 mt-2">{mock.description}</p>
                  </div>
                  <button type="button" onClick={() => handleLoadMock(mock, 'legacy')} className="btn-primary text-xs shrink-0">
                    Load
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-esg-forest mb-3">Custom mocks</h4>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              value={customMockName}
              onChange={(e) => setCustomMockName(e.target.value)}
              placeholder="Name for current payload"
              className="input-field max-w-xs text-sm"
            />
            <button
              type="button"
              onClick={handleSaveCustomMock}
              disabled={!jsonInput.trim() || !customMockName.trim()}
              className="btn-secondary text-sm"
            >
              Save current as mock
            </button>
          </div>
          {customMocks.length > 0 ? (
            <div className="space-y-2">
              {customMocks.map((mock) => (
                <div key={mock.id} className="flex items-center justify-between gap-3 rounded-lg border border-esg-mint/30 bg-esg-cream/30 px-4 py-2">
                  <div className="min-w-0">
                    <span className="font-medium text-esg-forest">{mock.name}</span>
                    <span className="text-xs text-esg-sage/70 ml-2">
                      {mock.type === 'sustainability' ? 'Sustainability' : 'Legacy'}
                      {mock.savedAt && ` · ${new Date(mock.savedAt).toLocaleDateString()}`}
                    </span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIngestionType(mock.type);
                        setJsonInput(typeof mock.payload === 'string' ? mock.payload : JSON.stringify(mock.payload, null, 2));
                      }}
                      className="btn-primary text-xs"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomMock(mock.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border-2 border-esg-alert/50 text-esg-alert hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-esg-sage/70">No custom mocks. Enter a payload, name it, and click "Save current as mock".</p>
          )}
        </div>
      </div>

      {/* Ingestion Type Selector */}
      <div className="card p-6">
        <h3 className="font-display font-semibold text-esg-forest mb-4">Ingestion Type</h3>
        <div className="flex gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => { setIngestionType('sustainability'); setJsonInput(''); }}
            className={`px-6 py-3 rounded-lg font-semibold transition-all border-2 ${
              ingestionType === 'sustainability'
                ? 'bg-esg-sage text-white border-esg-sage'
                : 'bg-white text-esg-forest border-esg-sage/50 hover:bg-esg-mint/40'
            }`}
          >
            Sustainability Telemetry
          </button>
          <button
            type="button"
            onClick={() => { setIngestionType('legacy'); setJsonInput(''); }}
            className={`px-6 py-3 rounded-lg font-semibold transition-all border-2 ${
              ingestionType === 'legacy'
                ? 'bg-esg-sage text-white border-esg-sage'
                : 'bg-white text-esg-forest border-esg-sage/50 hover:bg-esg-mint/40'
            }`}
          >
            Legacy Alerts (CO₂/Temp)
          </button>
        </div>
        <p className="text-sm text-esg-sage/80 mt-3">
          {ingestionType === 'sustainability'
            ? 'Submit comprehensive sustainability metrics: carbon, water, energy, compute, hardware, and data quality.'
            : 'Submit simple environmental sensor data: CO₂ ppm and temperature.'}
        </p>
      </div>

      {/* Options for Sustainability */}
      {ingestionType === 'sustainability' && (
        <div className="card p-6">
          <h3 className="font-display font-semibold text-esg-forest mb-4">Ingestion Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-esg-forest mb-2">Source ID (optional)</label>
              <input
                type="text"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                placeholder="gateway-01"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-esg-forest mb-2">Ingestion Source (optional)</label>
              <select value={ingestionSource} onChange={(e) => setIngestionSource(e.target.value)} className="input-field">
                <option value="manual-entry">Manual Entry</option>
                <option value="iot-gateway">IoT Gateway</option>
                <option value="utility-api">Utility API</option>
                <option value="erp-system">ERP System</option>
                <option value="fleet-system">Fleet System</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeScorecard}
                onChange={(e) => setIncludeScorecard(e.target.checked)}
                className="rounded border-esg-sage/30"
              />
              <span className="text-sm text-esg-forest">Include sustainability scorecard in response</span>
            </label>
          </div>
        </div>
      )}

      {/* JSON Input */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-esg-forest">Payload</h3>
          <div className="flex gap-2">
            <button type="button" onClick={handleLoadExample} className="btn-secondary text-sm">
              Load Example
            </button>
            <label className="btn-secondary text-sm cursor-pointer">
              Upload JSON
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={ingestionType === 'sustainability'
            ? 'Enter JSON payload with timestamp and at least one block (energy, carbon, water, compute, hardware, or data_quality)...'
            : 'Enter JSON payload with CO2_ppm and/or Temperature_C...'}
          className="w-full h-64 font-mono text-sm p-4 border border-esg-sage/30 rounded-lg focus:border-esg-sage focus:outline-none focus:ring-1 focus:ring-esg-sage"
        />
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!jsonInput.trim() || currentMutation.isPending}
            className="btn-primary"
          >
            {currentMutation.isPending ? 'Submitting...' : 'Submit Telemetry'}
          </button>
          {jsonInput && (
            <button type="button" onClick={() => setJsonInput('')} className="btn-secondary text-sm">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {currentMutation.isError && (
        <div className="card p-6 border-esg-alert bg-red-50">
          <h4 className="font-semibold text-esg-alert mb-2">Ingestion Failed</h4>
          <p className="text-sm text-esg-forest">
            {currentMutation.error?.data?.error?.message || currentMutation.error?.message || 'Unknown error occurred'}
          </p>
          {currentMutation.error?.status === 409 && (
            <p className="text-xs text-esg-sage/80 mt-2">This appears to be a duplicate payload. Check your source_id and external_event_id.</p>
          )}
        </div>
      )}

      {currentMutation.isSuccess && (
        <div className="card p-6 border-esg-success bg-esg-success/10">
          <h4 className="font-semibold text-esg-success mb-2">✓ Ingestion Successful</h4>
          <div className="text-sm text-esg-forest space-y-1">
            <p><strong>Status:</strong> {currentMutation.data?.status || 'accepted'}</p>
            {currentMutation.data?.raw_id && <p><strong>Raw ID:</strong> {currentMutation.data.raw_id}</p>}
            {currentMutation.data?.observation_time_utc && <p><strong>Observation Time:</strong> {currentMutation.data.observation_time_utc}</p>}
            {currentMutation.data?.alerts?.length > 0 && (
              <div className="mt-3">
                <strong className="text-esg-alert">Alerts Triggered:</strong>
                <ul className="list-disc list-inside mt-1">
                  {currentMutation.data.alerts.map((alert, idx) => (
                    <li key={idx} className="text-esg-alert">{alert.metric}: {alert.value} (threshold: {alert.threshold})</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <p className="text-sm text-esg-sage mt-3">Data will appear in the Dashboard tab momentarily.</p>
        </div>
      )}
    </div>
  );
}

// Main Combined Portal Component
export default function TelemetryIngestionPortal() {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [ingestionHistory, setIngestionHistory] = useState([]);

  // Persist active tab
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
    } catch {
      /* ignore */
    }
  }, [activeTab]);

  // Health query
  const healthQuery = useQuery({
    queryKey: ['telemetry-health'],
    queryFn: health,
    retry: 1,
    refetchInterval: 30_000,
  });

  // Metrics query - shared across tabs
  const metricsQuery = useQuery({
    queryKey: ['telemetry-metrics'],
    queryFn: getMetricsReport,
    retry: 1,
    refetchInterval: activeTab === 'dashboard' ? 10_000 : 30_000, // Faster refresh when viewing dashboard
  });

  const handleIngestSuccess = (entry) => {
    setIngestionHistory((prev) => [
      { id: Date.now(), timestamp: new Date().toISOString(), status: 'success', ...entry },
      ...prev.slice(0, 19), // Keep last 20
    ]);
    // Auto-switch to dashboard to show new data
    setActiveTab('dashboard');
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', count: null },
    { id: 'ingest', label: 'Ingest Data', count: null },
    { id: 'history', label: 'History', count: ingestionHistory.length > 0 ? ingestionHistory.length : null },
  ];

  return (
    <section className="space-y-6">
      <PageHeader
        title="Telemetry & Ingestion Portal"
        description="Unified interface for ingesting sustainability data and viewing real-time telemetry metrics. Data flows seamlessly between ingestion and visualization."
        status={healthQuery.isError ? 'error' : 'success'}
        isLoading={healthQuery.isLoading}
      />

      {/* Navigation Tabs */}
      <div className="border-b border-esg-sage/20">
        <nav className="flex gap-1" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-esg-sage text-esg-sage'
                  : 'border-transparent text-esg-forest/70 hover:text-esg-forest hover:border-esg-sage/30'
                }
              `}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-esg-sage/20 text-esg-sage">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'dashboard' && <DashboardTab metricsQuery={metricsQuery} />}
        
        {activeTab === 'ingest' && <IngestionTab onIngestSuccess={handleIngestSuccess} />}
        
        {activeTab === 'history' && (
          <div className="space-y-6">
            {ingestionHistory.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-esg-sage/80">No ingestion history yet.</p>
                <p className="text-sm text-esg-sage/60 mt-2">
                  Ingest some data to see your history here.
                </p>
                <button
                  onClick={() => setActiveTab('ingest')}
                  className="btn-primary mt-4"
                >
                  Go to Ingest Data
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-esg-forest">Recent Ingestions</h3>
                  <button
                    type="button"
                    onClick={() => setIngestionHistory([])}
                    className="btn-secondary text-sm"
                  >
                    Clear History
                  </button>
                </div>
                <div className="space-y-3">
                  {ingestionHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-4 rounded-lg border ${
                        entry.status === 'success'
                          ? 'bg-esg-success/10 border-esg-success/30'
                          : 'bg-red-50 border-esg-alert/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-esg-forest">
                            {entry.type === 'sustainability' ? 'Sustainability Telemetry' : 'Legacy Alert'}
                          </span>
                          <span className="text-esg-sage/70 ml-3 text-sm">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          entry.status === 'success'
                            ? 'bg-esg-success/20 text-esg-success'
                            : 'bg-esg-alert/20 text-esg-alert'
                        }`}>
                          {entry.status === 'success' ? 'Success' : 'Failed'}
                        </span>
                      </div>
                      {entry.data?.raw_id && (
                        <div className="text-xs text-esg-sage/80 mt-2">
                          Raw ID: {entry.data.raw_id}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Documentation Footer */}
      <div className="card p-6 bg-gradient-to-br from-esg-mint/10 to-esg-cream/50">
        <h3 className="font-display font-semibold text-esg-forest mb-3">Quick Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-esg-sage/90">
          <div>
            <strong className="text-esg-forest">Sustainability Telemetry:</strong>
            <p className="mt-1">Requires timestamp + at least one block: energy, carbon, water, compute, hardware, or data_quality.</p>
          </div>
          <div>
            <strong className="text-esg-forest">Legacy Alerts:</strong>
            <p className="mt-1">Simple JSON with CO2_ppm and/or Temperature_C fields.</p>
          </div>
          <div>
            <strong className="text-esg-forest">Data Flow:</strong>
            <p className="mt-1">Ingested data appears in Dashboard within seconds. Use unique external_event_id to prevent duplicates.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
