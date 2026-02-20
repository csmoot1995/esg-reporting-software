import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMetricsReport, health } from '../../api/telemetry';
import { useMemo, useState } from 'react';
import PageHeader from '../shared/PageHeader';
import MetricCard from '../shared/MetricCard';
import { 
  Cloud, Droplets, Zap, Cpu, Shield, 
  Activity, Globe, Server, TrendingUp, AlertTriangle,
  Clock, RefreshCw
} from 'lucide-react';

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

// Icon mapping for metric types
const getMetricIcon = (metricType) => {
  const type = metricType?.toLowerCase() || '';
  if (type.includes('carbon') || type.includes('co2')) return <Cloud className="w-4 h-4" />;
  if (type.includes('water')) return <Droplets className="w-4 h-4 text-blue-500" />;
  if (type.includes('pue') || type.includes('wue') || type.includes('efficiency') || type.includes('dcie')) return <Zap className="w-4 h-4 text-amber-500" />;
  if (type.includes('gpu') || type.includes('utilization') || type.includes('cpu') || type.includes('memory')) return <Cpu className="w-4 h-4 text-purple-500" />;
  if (type.includes('quality') || type.includes('coverage') || type.includes('freshness')) return <Shield className="w-4 h-4 text-green-500" />;
  return <Activity className="w-4 h-4" />;
};

// Section icon mapping
const sectionIcons = {
  'Carbon Metrics': <Cloud className="w-5 h-5 text-emerald-600" />,
  'Water Metrics': <Droplets className="w-5 h-5 text-blue-500" />,
  'Efficiency Metrics': <Zap className="w-5 h-5 text-amber-500" />,
  'Hardware Metrics': <Server className="w-5 h-5 text-purple-500" />,
  'Data Quality Metrics': <Shield className="w-5 h-5 text-green-500" />,
};

// Summary card icons
const summaryIcons = {
  'Average PUE': <Zap className="w-5 h-5 text-amber-500" />,
  'Average Utilization': <Activity className="w-5 h-5 text-purple-500" />,
  'Total Carbon': <Cloud className="w-5 h-5 text-emerald-600" />,
  'Total Water': <Droplets className="w-5 h-5 text-blue-500" />,
};

function MetricDetailModal({ metric, onClose }) {
  if (!metric) return null;
  
  const isCritical =
    (metric.metric_type === 'pue' && metric.value > 2.0) ||
    (metric.metric_type === 'utilization_pct' && metric.value < 30) ||
    (metric.metric_type === 'wue' && metric.value > 2.0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-esg-mint/30 rounded-lg">
            {getMetricIcon(metric.metric_type)}
          </div>
          <div>
            <h3 className="font-display font-semibold text-esg-forest">{formatMetricName(metric.metric_type)}</h3>
            <span className={`text-xs px-2 py-1 rounded-full ${isCritical ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {isCritical ? 'Needs Attention' : 'Healthy'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-esg-cream/50 rounded-lg p-3">
            <div className="text-xs text-esg-sage/70">Value</div>
            <div className={`text-xl font-bold ${isCritical ? 'text-red-600' : 'text-esg-forest'}`}>
              {metric.value?.toFixed(2)} {metric.unit}
            </div>
          </div>
          <div className="bg-esg-cream/50 rounded-lg p-3">
            <div className="text-xs text-esg-sage/70">Timestamp</div>
            <div className="text-sm text-esg-forest">
              {metric.timestamp_utc ? new Date(metric.timestamp_utc).toLocaleString() : 'N/A'}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {metric.asset_id && (
            <div className="flex justify-between">
              <span className="text-esg-sage/70">Asset:</span>
              <span className="font-medium text-esg-forest">{metric.asset_id.replace(/_/g, ' ')}</span>
            </div>
          )}
          {metric.region && (
            <div className="flex justify-between">
              <span className="text-esg-sage/70">Region:</span>
              <span className="font-medium text-esg-forest">{metric.region.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>

        <button 
          onClick={onClose}
          className="mt-6 w-full py-2 bg-esg-forest text-white rounded-lg hover:bg-esg-forest/90 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function MetricSection({ title, metrics, emptyMessage = 'No metrics available' }) {
  const [selectedMetric, setSelectedMetric] = useState(null);
  
  if (!metrics || metrics.length === 0) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-3">
          {sectionIcons[title] || <Activity className="w-5 h-5" />}
          <h3 className="font-display font-semibold text-esg-forest">{title}</h3>
        </div>
        <p className="text-sm text-esg-sage/80">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          {sectionIcons[title] || <Activity className="w-5 h-5" />}
          <h3 className="font-display font-semibold text-esg-forest">{title}</h3>
          <span className="ml-auto text-xs text-esg-sage/60 bg-esg-mint/20 px-2 py-1 rounded-full">
            {metrics.length} metric{metrics.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric, idx) => {
            const isCritical =
              (metric.metric_type === 'pue' && metric.value > 2.0) ||
              (metric.metric_type === 'utilization_pct' && metric.value < 30) ||
              (metric.metric_type === 'wue' && metric.value > 2.0);
            return (
              <div key={idx} onClick={() => setSelectedMetric(metric)} className="cursor-pointer">
                <MetricCard
                  title={formatMetricName(metric.metric_type)}
                  value={metric.value}
                  unit={metric.unit}
                  subtitle={metric.asset_id ? `Asset: ${metric.asset_id.replace(/_/g, ' ')}` : metric.region ? `Region: ${metric.region.replace(/_/g, ' ')}` : null}
                  critical={isCritical}
                  icon={getMetricIcon(metric.metric_type)}
                  onClick={() => setSelectedMetric(metric)}
                />
              </div>
            );
          })}
        </div>
      </div>
      <MetricDetailModal metric={selectedMetric} onClose={() => setSelectedMetric(null)} />
    </>
  );
}

export default function TelemetryDashboard() {
  const healthQuery = useQuery({
    queryKey: ['telemetry-health'],
    queryFn: health,
    retry: 1,
    refetchInterval: 30_000,
  });

  const metricsQuery = useQuery({
    queryKey: ['telemetry-metrics'],
    queryFn: getMetricsReport,
    retry: 1,
    refetchInterval: 10_000, // Refresh every 10 seconds
  });

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
        },
      };
    }, [metricsQuery.data]);

  const latestTimestamp = useMemo(() => {
    const allMetrics = [
      ...(carbonMetrics || []),
      ...(waterMetrics || []),
      ...(efficiencyMetrics || []),
      ...(hardwareMetrics || []),
      ...(dataQualityMetrics || []),
    ];
    if (allMetrics.length === 0) return null;
    const timestamps = allMetrics.map((m) => m.timestamp_utc).filter(Boolean);
    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps.map((t) => new Date(t).getTime())));
  }, [carbonMetrics, waterMetrics, efficiencyMetrics, hardwareMetrics, dataQualityMetrics]);

  return (
    <section className="space-y-8">
      <PageHeader
        title="Sustainability Telemetry Dashboard"
        description="Real-time metrics for carbon, water, efficiency, hardware, and data quality. Updates every 10 seconds."
        status={healthQuery.isError ? 'error' : 'success'}
        isLoading={healthQuery.isLoading}
        actions={
          latestTimestamp && (
            <span className="text-sm text-esg-sage/80">
              Last update: {latestTimestamp.toLocaleTimeString()}
            </span>
          )
        }
      />

      {/* Contextual Info */}
      <div className="card p-4 bg-esg-mint/10 border-l-4 border-esg-sage">
        <p className="text-sm text-esg-sage/90">
          <strong className="text-esg-forest">Related:</strong> Set up alerts for threshold breaches or use the simulator to project improvements.{' '}
          <Link to="/alerts" className="text-esg-sage hover:underline font-medium">
            Configure alerts →
          </Link>
          {' '}or{' '}
          <Link to="/simulator" className="text-esg-sage hover:underline font-medium">
            Try simulator →
          </Link>
        </p>
      </div>

      {/* Summary Stats */}
      {(summaryStats.totalCarbon > 0 || summaryStats.totalWater > 0 || summaryStats.avgPUE || summaryStats.avgUtilization) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryStats.avgPUE != null && (
            <div className="relative overflow-hidden">
              <MetricCard
                title="Average PUE"
                value={summaryStats.avgPUE}
                unit=""
                subtitle="Power Usage Effectiveness"
                critical={summaryStats.avgPUE > 2.0}
                icon={summaryIcons['Average PUE']}
              />
              {summaryStats.avgPUE > 2.0 && (
                <div className="absolute top-2 right-2">
                  <AlertTriangle className="w-4 h-4 text-esg-alert" />
                </div>
              )}
            </div>
          )}
          {summaryStats.avgUtilization != null && (
            <div className="relative overflow-hidden">
              <MetricCard
                title="Average Utilization"
                value={summaryStats.avgUtilization}
                unit="%"
                subtitle="Hardware utilization"
                critical={summaryStats.avgUtilization < 30}
                icon={summaryIcons['Average Utilization']}
              />
              {summaryStats.avgUtilization < 30 && (
                <div className="absolute top-2 right-2">
                  <AlertTriangle className="w-4 h-4 text-esg-alert" />
                </div>
              )}
            </div>
          )}
          {summaryStats.totalCarbon > 0 && (
            <MetricCard 
              title="Total Carbon" 
              value={summaryStats.totalCarbon} 
              unit="kg CO₂e" 
              subtitle="Cumulative" 
              icon={summaryIcons['Total Carbon']}
            />
          )}
          {summaryStats.totalWater > 0 && (
            <MetricCard 
              title="Total Water" 
              value={summaryStats.totalWater} 
              unit="L" 
              subtitle="Cumulative" 
              icon={summaryIcons['Total Water']}
            />
          )}
        </div>
      )}

      {/* Carbon Metrics */}
      <MetricSection
        title="Carbon Metrics"
        metrics={carbonMetrics}
        emptyMessage="No carbon metrics available. Ingest telemetry with carbon data to see metrics."
      />

      {/* Water Metrics */}
      <MetricSection
        title="Water Metrics"
        metrics={waterMetrics}
        emptyMessage="No water metrics available. Ingest telemetry with water data to see metrics."
      />

      {/* Efficiency Metrics */}
      <MetricSection
        title="Efficiency Metrics"
        metrics={efficiencyMetrics}
        emptyMessage="No efficiency metrics available. Ingest telemetry with efficiency data to see metrics."
      />

      {/* Hardware Metrics */}
      <MetricSection
        title="Hardware Metrics"
        metrics={hardwareMetrics}
        emptyMessage="No hardware metrics available. Ingest telemetry with hardware data to see metrics."
      />

      {/* Data Quality Metrics */}
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
    </section>
  );
}
