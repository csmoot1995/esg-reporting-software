import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMetricsReport, health } from '../../api/telemetry';
import { useMemo } from 'react';
import PageHeader from '../shared/PageHeader';
import MetricCard from '../shared/MetricCard';

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

// MetricCard is now imported from shared components

function MetricSection({ title, metrics, emptyMessage = 'No metrics available' }) {
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
          const isCritical =
            (metric.metric_type === 'pue' && metric.value > 2.0) ||
            (metric.metric_type === 'utilization_pct' && metric.value < 30) ||
            (metric.metric_type === 'wue' && metric.value > 2.0);
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
          {summaryStats.totalWater > 0 && (
            <MetricCard title="Total Water" value={summaryStats.totalWater} unit="L" subtitle="Cumulative" />
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
