import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import MetricCard from '../shared/MetricCard';
import QuickLink from '../shared/QuickLink';
import StatusBadge from '../shared/StatusBadge';
import { health as complianceHealth } from '../../api/compliance';
import { health as alertsHealth } from '../../api/alerts';
import { health as simulatorHealth } from '../../api/simulator';
import { health as telemetryHealth, getMetricsReport } from '../../api/telemetry';

export default function OverviewDashboard() {
  // Health checks for all services
  const complianceHealthQuery = useQuery({
    queryKey: ['compliance-health'],
    queryFn: complianceHealth,
    retry: 1,
    refetchInterval: 30_000,
  });

  const alertsHealthQuery = useQuery({
    queryKey: ['alerts-health'],
    queryFn: alertsHealth,
    retry: 1,
    refetchInterval: 30_000,
  });

  const simulatorHealthQuery = useQuery({
    queryKey: ['simulator-health'],
    queryFn: simulatorHealth,
    retry: 1,
    refetchInterval: 30_000,
  });

  const telemetryHealthQuery = useQuery({
    queryKey: ['telemetry-health'],
    queryFn: telemetryHealth,
    retry: 1,
    refetchInterval: 30_000,
  });

  // Get telemetry metrics for overview
  const metricsQuery = useQuery({
    queryKey: ['telemetry-metrics'],
    queryFn: getMetricsReport,
    retry: 1,
    refetchInterval: 10_000,
  });

  const metrics = metricsQuery.data || {};
  const carbonMetrics = metrics.carbon || [];
  const waterMetrics = metrics.water || [];
  const efficiencyMetrics = metrics.efficiency || [];
  const hardwareMetrics = metrics.hardware || [];

  // Calculate summary stats
  const summaryStats = {
    totalCarbon: carbonMetrics.reduce((sum, m) => sum + (m.value || 0), 0) || 0,
    totalWater: waterMetrics.reduce((sum, m) => sum + (m.value || 0), 0) || 0,
    avgPUE: efficiencyMetrics.find((m) => m.metric_type === 'pue')?.value || null,
    avgUtilization: hardwareMetrics.find((m) => m.metric_type === 'utilization_pct')?.value || null,
    sustainabilityScore: metrics.sustainability_score || null,
  };

  const allServicesHealthy =
    !complianceHealthQuery.isError &&
    !alertsHealthQuery.isError &&
    !simulatorHealthQuery.isError &&
    !telemetryHealthQuery.isError &&
    !complianceHealthQuery.isLoading &&
    !alertsHealthQuery.isLoading &&
    !simulatorHealthQuery.isLoading &&
    !telemetryHealthQuery.isLoading;

  return (
    <section className="space-y-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-esg-forest mb-2">Sustainability Dashboard</h1>
        <p className="text-esg-sage/90">
          Unified view of your AI data center's environmental performance, compliance status, and sustainability metrics.
        </p>
      </div>

      {/* System Status */}
      <div className="card p-6">
        <h3 className="font-display font-semibold text-esg-forest mb-4">System Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-esg-cream/50">
            <span className="text-sm font-medium text-esg-forest">Compliance</span>
            <StatusBadge
              status={complianceHealthQuery.isError ? 'error' : 'success'}
              isLoading={complianceHealthQuery.isLoading}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-esg-cream/50">
            <span className="text-sm font-medium text-esg-forest">Alerts</span>
            <StatusBadge
              status={alertsHealthQuery.isError ? 'error' : 'success'}
              isLoading={alertsHealthQuery.isLoading}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-esg-cream/50">
            <span className="text-sm font-medium text-esg-forest">Simulator</span>
            <StatusBadge
              status={simulatorHealthQuery.isError ? 'error' : 'success'}
              isLoading={simulatorHealthQuery.isLoading}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-esg-cream/50">
            <span className="text-sm font-medium text-esg-forest">Telemetry</span>
            <StatusBadge
              status={telemetryHealthQuery.isError ? 'error' : 'success'}
              isLoading={telemetryHealthQuery.isLoading}
            />
          </div>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div>
        <h3 className="font-display font-semibold text-esg-forest mb-4">Key Metrics</h3>
        {(summaryStats.totalCarbon > 0 ||
          summaryStats.totalWater > 0 ||
          summaryStats.avgPUE ||
          summaryStats.avgUtilization ||
          summaryStats.sustainabilityScore) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryStats.sustainabilityScore != null && (
              <MetricCard
                title="Sustainability Score"
                value={summaryStats.sustainabilityScore}
                unit=""
                subtitle="Overall performance"
                onClick={() => (window.location.href = '/telemetry')}
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
                onClick={() => (window.location.href = '/telemetry')}
              />
            )}
            {summaryStats.avgUtilization != null && (
              <MetricCard
                title="Hardware Utilization"
                value={summaryStats.avgUtilization}
                unit="%"
                subtitle="Average utilization rate"
                critical={summaryStats.avgUtilization < 30}
                onClick={() => (window.location.href = '/telemetry')}
              />
            )}
            {summaryStats.totalCarbon > 0 && (
              <MetricCard
                title="Total Carbon"
                value={summaryStats.totalCarbon}
                unit="kg CO₂e"
                subtitle="Cumulative emissions"
                onClick={() => (window.location.href = '/telemetry')}
              />
            )}
            {summaryStats.totalWater > 0 && (
              <MetricCard
                title="Total Water"
                value={summaryStats.totalWater}
                unit="L"
                subtitle="Cumulative usage"
                onClick={() => (window.location.href = '/telemetry')}
              />
            )}
          </div>
        ) : (
          <div className="card p-6">
            <p className="text-sm text-esg-sage/80">
              No metrics available yet. Start by ingesting telemetry data or{' '}
              <Link to="/telemetry" className="text-esg-sage hover:underline font-medium">
                telemetry portal →
              </Link>
            </p>
          </div>
        )}
      </div>

      {/* Quick Access Cards */}
      <div>
        <h3 className="font-display font-semibold text-esg-forest mb-4">Quick Access</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickLink
            to="/telemetry"
            title="Telemetry Portal"
            description="Ingest data & view real-time sustainability metrics"
            icon="�"
            badge={telemetryHealthQuery.isError ? 'Offline' : 'Active'}
          />
          <QuickLink
            to="/compliance"
            title="Compliance"
            description="Upload and validate ESG reports"
            icon="📋"
            badge={complianceHealthQuery.isError ? 'Offline' : 'Active'}
          />
          <QuickLink
            to="/alerts"
            title="Real-Time Alerts"
            description="Monitor CO₂ and temperature thresholds"
            icon="⚠️"
            badge={alertsHealthQuery.isError ? 'Offline' : 'Live'}
          />
          <QuickLink
            to="/simulator"
            title="What-If Simulator"
            description="Project carbon footprint scenarios"
            icon="🔮"
            badge={simulatorHealthQuery.isError ? 'Offline' : 'Ready'}
          />
        </div>
      </div>

      {/* Contextual Insights */}
      <div className="card p-6 bg-gradient-to-br from-esg-mint/10 to-esg-cream/50">
        <h3 className="font-display font-semibold text-esg-forest mb-3">Insights & Recommendations</h3>
        <div className="space-y-3 text-sm text-esg-sage/90">
          {summaryStats.avgPUE != null && summaryStats.avgPUE > 2.0 && (
            <div className="flex items-start gap-2">
              <span className="text-esg-alert">⚠️</span>
              <div>
                <strong className="text-esg-forest">High PUE detected:</strong> Your PUE of {summaryStats.avgPUE.toFixed(2)} exceeds
                the recommended threshold of 2.0. Consider reviewing cooling efficiency.{' '}
                <Link to="/telemetry" className="text-esg-sage hover:underline">
                  View telemetry →
                </Link>
              </div>
            </div>
          )}
          {summaryStats.avgUtilization != null && summaryStats.avgUtilization < 30 && (
            <div className="flex items-start gap-2">
              <span className="text-esg-alert">⚠️</span>
              <div>
                <strong className="text-esg-forest">Low utilization:</strong> Hardware utilization at{' '}
                {summaryStats.avgUtilization.toFixed(1)}% is below optimal. Review workload distribution.{' '}
                <Link to="/telemetry" className="text-esg-sage hover:underline">
                  View telemetry →
                </Link>
              </div>
            </div>
          )}
          {allServicesHealthy && (
            <div className="flex items-start gap-2">
              <span className="text-esg-success">✓</span>
              <div>
                <strong className="text-esg-forest">All systems operational:</strong> All services are connected and
                functioning normally.
              </div>
            </div>
          )}
          {summaryStats.totalCarbon > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-esg-sage">💡</span>
              <div>
                <strong className="text-esg-forest">Optimization opportunity:</strong> Use the What-If Simulator to
                explore scenarios for reducing your carbon footprint.{' '}
                <Link to="/simulator" className="text-esg-sage hover:underline">
                  Try simulator →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
