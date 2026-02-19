import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ingestTelemetry, health } from '../../api/telemetry';
import { processTelemetry } from '../../api/alerts';
import PageHeader from '../shared/PageHeader';
import { SUSTAINABILITY_MOCKS, LEGACY_MOCKS, getMockPayloadJson } from '../../mocks/ingestionMocks';

const CUSTOM_MOCKS_STORAGE_KEY = 'esg-ingestion-custom-mocks';

export default function IngestionPortal() {
  const [ingestionType, setIngestionType] = useState('sustainability'); // 'sustainability' or 'legacy'
  const [jsonInput, setJsonInput] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [ingestionSource, setIngestionSource] = useState('manual-entry');
  const [includeScorecard, setIncludeScorecard] = useState(false);
  const [ingestionHistory, setIngestionHistory] = useState([]);
  const [customMocks, setCustomMocks] = useState(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_MOCKS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [customMockName, setCustomMockName] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_MOCKS_STORAGE_KEY, JSON.stringify(customMocks));
    } catch (e) {
      /* ignore */
    }
  }, [customMocks]);

  const healthQuery = useQuery({
    queryKey: ['telemetry-health'],
    queryFn: health,
    retry: 1,
    refetchInterval: 30_000,
  });

  const sustainabilityMutation = useMutation({
    mutationFn: (payload) =>
      ingestTelemetry(payload, {
        sourceId: sourceId || undefined,
        ingestionSource: ingestionSource || undefined,
        includeScorecard,
      }),
    onSuccess: (data) => {
      setIngestionHistory((prev) => [
        {
          id: Date.now(),
          type: 'sustainability',
          timestamp: new Date().toISOString(),
          status: 'success',
          data: data,
        },
        ...prev.slice(0, 9),
      ]);
      setJsonInput('');
    },
  });

  const legacyMutation = useMutation({
    mutationFn: (payload) => processTelemetry(payload),
    onSuccess: (data) => {
      setIngestionHistory((prev) => [
        {
          id: Date.now(),
          type: 'legacy',
          timestamp: new Date().toISOString(),
          status: 'success',
          data: data,
        },
        ...prev.slice(0, 9),
      ]);
      setJsonInput('');
    },
  });

  const handleLoadExample = () => {
    const mock = ingestionType === 'sustainability'
      ? SUSTAINABILITY_MOCKS[0]
      : LEGACY_MOCKS[0];
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
        // Ensure timestamp is present
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
    <section className="space-y-8">
      <PageHeader
        title="Telemetry Ingestion Portal"
        description="Submit sustainability telemetry data or legacy alerts. Supports JSON upload and form entry."
        status={healthQuery.isError ? 'error' : 'success'}
        isLoading={healthQuery.isLoading}
      />

      {/* Contextual Info */}
      <div className="card p-4 bg-esg-mint/10 border-l-4 border-esg-sage">
        <p className="text-sm text-esg-sage/90">
          <strong className="text-esg-forest">Tip:</strong> After ingestion, view metrics in the{' '}
          <Link to="/telemetry" className="text-esg-sage hover:underline font-medium">
            telemetry dashboard →
          </Link>
          {' '}or check{' '}
          <Link to="/alerts" className="text-esg-sage hover:underline font-medium">
            alerts →
          </Link>
          {' '}for threshold breaches.
        </p>
      </div>

      {/* Mock Library — preset and deletable custom mocks */}
      <div className="card p-6">
        <h3 className="font-display font-semibold text-esg-forest mb-2">Mock Library</h3>
        <p className="text-sm text-esg-sage/80 mb-4">
          Load preset JSON by vertical and AI data center type to test ingestion. Each load generates a unique event ID. Custom mocks can be saved and deleted.
        </p>

        {/* Preset: Sustainability */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-esg-forest mb-3">Sustainability telemetry (by vertical)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {SUSTAINABILITY_MOCKS.map((mock) => (
              <div
                key={mock.id}
                className="rounded-lg border border-esg-mint/30 bg-white p-4 hover:border-esg-sage/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-esg-forest truncate">{mock.name}</div>
                    <div className="text-xs text-esg-sage/70 mt-0.5">{mock.vertical}</div>
                    <p className="text-xs text-esg-sage/80 mt-2 line-clamp-2">{mock.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLoadMock(mock, 'sustainability')}
                    className="btn-primary text-xs shrink-0"
                  >
                    Load
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preset: Legacy */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-esg-forest mb-3">Legacy alerts (CO₂ / temperature)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {LEGACY_MOCKS.map((mock) => (
              <div
                key={mock.id}
                className="rounded-lg border border-esg-mint/30 bg-white p-4 hover:border-esg-sage/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-esg-forest">{mock.name}</div>
                    <p className="text-xs text-esg-sage/80 mt-2">{mock.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLoadMock(mock, 'legacy')}
                    className="btn-primary text-xs shrink-0"
                  >
                    Load
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom mocks (deletable) */}
        <div>
          <h4 className="text-sm font-semibold text-esg-forest mb-3">Custom mocks (saved locally, deletable)</h4>
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
                <div
                  key={mock.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-esg-mint/30 bg-esg-cream/30 px-4 py-2"
                >
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
                      title="Delete this mock"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-esg-sage/70">No custom mocks. Enter a payload, name it, and click “Save current as mock”.</p>
          )}
        </div>
      </div>

      {/* Ingestion Type Selector */}
      <div className="card p-6">
        <h3 className="font-display font-semibold text-esg-forest mb-4">Ingestion Type</h3>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => {
              setIngestionType('sustainability');
              setJsonInput('');
            }}
            className={`
              px-6 py-3 rounded-lg font-semibold transition-all border-2
              ${
                ingestionType === 'sustainability'
                  ? 'bg-esg-sage text-white border-esg-sage'
                  : 'bg-white text-esg-forest border-esg-sage/50 hover:bg-esg-mint/40'
              }
            `}
          >
            Sustainability Telemetry
          </button>
          <button
            type="button"
            onClick={() => {
              setIngestionType('legacy');
              setJsonInput('');
            }}
            className={`
              px-6 py-3 rounded-lg font-semibold transition-all border-2
              ${
                ingestionType === 'legacy'
                  ? 'bg-esg-sage text-white border-esg-sage'
                  : 'bg-white text-esg-forest border-esg-sage/50 hover:bg-esg-mint/40'
              }
            `}
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
              <select
                value={ingestionSource}
                onChange={(e) => setIngestionSource(e.target.value)}
                className="input-field"
              >
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
            <button
              type="button"
              onClick={handleLoadExample}
              className="btn-secondary text-sm"
            >
              Load Example
            </button>
            <label className="btn-secondary text-sm cursor-pointer">
              Upload JSON
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={
            ingestionType === 'sustainability'
              ? 'Enter JSON payload with timestamp and at least one block (energy, carbon, water, compute, hardware, or data_quality)...'
              : 'Enter JSON payload with CO2_ppm and/or Temperature_C...'
          }
          className="w-full h-64 font-mono text-sm p-4 border border-esg-sage/30 rounded-lg focus:border-esg-sage focus:outline-none focus:ring-1 focus:ring-esg-sage"
        />
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!jsonInput.trim() || currentMutation.isPending || healthQuery.isError}
            className="btn-primary"
          >
            {currentMutation.isPending ? 'Submitting...' : 'Submit Telemetry'}
          </button>
          {jsonInput && (
            <button
              type="button"
              onClick={() => setJsonInput('')}
              className="btn-secondary text-sm"
            >
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
            {currentMutation.error?.data?.error?.message ||
              currentMutation.error?.message ||
              'Unknown error occurred'}
          </p>
          {currentMutation.error?.status === 409 && (
            <p className="text-xs text-esg-sage/80 mt-2">
              This appears to be a duplicate payload. Check your source_id and external_event_id.
            </p>
          )}
        </div>
      )}

      {currentMutation.isSuccess && (
        <div className="card p-6 border-esg-success bg-esg-success/10">
          <h4 className="font-semibold text-esg-success mb-2">Ingestion Successful</h4>
          <div className="text-sm text-esg-forest space-y-1">
            <p>
              <strong>Status:</strong> {currentMutation.data?.status || 'accepted'}
            </p>
            {currentMutation.data?.raw_id && (
              <p>
                <strong>Raw ID:</strong> {currentMutation.data.raw_id}
              </p>
            )}
            {currentMutation.data?.observation_time_utc && (
              <p>
                <strong>Observation Time:</strong> {currentMutation.data.observation_time_utc}
              </p>
            )}
            {currentMutation.data?.alerts && currentMutation.data.alerts.length > 0 && (
              <div className="mt-3">
                <strong className="text-esg-alert">Alerts Triggered:</strong>
                <ul className="list-disc list-inside mt-1">
                  {currentMutation.data.alerts.map((alert, idx) => (
                    <li key={idx} className="text-esg-alert">
                      {alert.metric}: {alert.value} (threshold: {alert.threshold})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {currentMutation.data?.summary && (
              <details className="mt-3">
                <summary className="cursor-pointer text-esg-sage hover:text-esg-forest">
                  View Summary
                </summary>
                <pre className="mt-2 p-3 bg-white rounded text-xs overflow-auto">
                  {JSON.stringify(currentMutation.data.summary, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Ingestion History */}
      {ingestionHistory.length > 0 && (
        <div className="card p-6">
          <h3 className="font-display font-semibold text-esg-forest mb-4">Recent Ingestion History</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {ingestionHistory.map((entry) => (
              <div
                key={entry.id}
                className={`p-3 rounded-lg border ${
                  entry.status === 'success'
                    ? 'bg-esg-success/10 border-esg-success/30'
                    : 'bg-red-50 border-esg-alert/30'
                }`}
              >
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-esg-forest">
                      {entry.type === 'sustainability' ? 'Sustainability' : 'Legacy'} Telemetry
                    </span>
                    <span className="text-esg-sage/70 ml-2">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      entry.status === 'success'
                        ? 'bg-esg-success/20 text-esg-success'
                        : 'bg-esg-alert/20 text-esg-alert'
                    }`}
                  >
                    {entry.status === 'success' ? 'Success' : 'Failed'}
                  </span>
                </div>
                {entry.data?.status && (
                  <div className="text-xs text-esg-sage/80 mt-1">
                    Status: {entry.data.status}
                    {entry.data.raw_id && ` | Raw ID: ${entry.data.raw_id}`}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIngestionHistory([])}
            className="btn-secondary text-sm mt-4"
          >
            Clear History
          </button>
        </div>
      )}

      {/* Documentation */}
      <div className="card p-6 bg-gradient-to-br from-esg-mint/10 to-esg-cream/50">
        <h3 className="font-display font-semibold text-esg-forest mb-3">Documentation</h3>
        <div className="text-sm text-esg-sage/90 space-y-2">
          <p>
            <strong className="text-esg-forest">Sustainability Telemetry:</strong> Requires a{' '}
            <code className="bg-white px-1 py-0.5 rounded text-xs">timestamp</code> and at least one block:
            energy, carbon, water, compute, hardware, or data_quality.
          </p>
          <p>
            <strong className="text-esg-forest">Legacy Alerts:</strong> Simple JSON with{' '}
            <code className="bg-white px-1 py-0.5 rounded text-xs">CO2_ppm</code> and/or{' '}
            <code className="bg-white px-1 py-0.5 rounded text-xs">Temperature_C</code>.
          </p>
          <p>
            <strong className="text-esg-forest">Idempotency:</strong> Use unique{' '}
            <code className="bg-white px-1 py-0.5 rounded text-xs">external_event_id</code> values to prevent
            duplicate ingestion.
          </p>
        </div>
      </div>
    </section>
  );
}
