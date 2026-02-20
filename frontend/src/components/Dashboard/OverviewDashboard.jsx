import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import MetricPlate from '../shared/MetricPlate';
import QuickLink from '../shared/QuickLink';
import StatusBadge from '../shared/StatusBadge';
import { health as complianceHealth } from '../../api/compliance';
import { health as alertsHealth } from '../../api/alerts';
import { health as simulatorHealth } from '../../api/simulator';
import { health as telemetryHealth, getMetricsReport } from '../../api/telemetry';
import { 
  Cloud, Droplets, Zap, Activity, TrendingUp, 
  AlertTriangle, CheckCircle2, ArrowRight
} from 'lucide-react';

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

  // Get the most recent metrics with full lineage data
  const latestPUE = efficiencyMetrics.find((m) => m.metric_type === 'pue');
  const latestUtil = hardwareMetrics.find((m) => m.metric_type === 'utilization_pct');
  const latestCarbon = carbonMetrics[0];
  const latestWater = waterMetrics[0];

  // Calculate summary stats
  const summaryStats = {
    totalCarbon: carbonMetrics.reduce((sum, m) => sum + (m.value || 0), 0) || 0,
    totalWater: waterMetrics.reduce((sum, m) => sum + (m.value || 0), 0) || 0,
    avgPUE: latestPUE?.value || null,
    avgUtilization: latestUtil?.value || null,
    sustainabilityScore: metrics.sustainability_score || null,
    // Store full metric objects for rich data display
    latestPUE,
    latestUtil,
    latestCarbon,
    latestWater,
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
          Unified view of your organization's environmental performance, compliance status, and sustainability metrics across all operations.
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

      {/* Key Metrics Overview - Now with MetricPlate for rich interactivity */}
      <div>
        <h3 className="font-display font-semibold text-esg-forest mb-4">Key Metrics</h3>
        {(summaryStats.totalCarbon > 0 ||
          summaryStats.totalWater > 0 ||
          summaryStats.avgPUE ||
          summaryStats.avgUtilization ||
          summaryStats.sustainabilityScore) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryStats.sustainabilityScore != null && (
              <MetricPlate
                title="Sustainability Score"
                value={summaryStats.sustainabilityScore}
                unit=""
                subtitle="Overall performance"
                status="healthy"
                icon={<CheckCircle2 className="w-4 h-4 text-esg-success" />}
                className="border-l-4 border-esg-success"
                relatedLinks={[
                  { to: '/telemetry', label: 'View detailed metrics →', icon: <ArrowRight className="w-3 h-3" /> },
                  { to: '/simulator', label: 'Try what-if scenarios →', icon: <ArrowRight className="w-3 h-3" /> },
                ]}
              />
            )}
            {summaryStats.avgPUE != null && (
              <MetricPlate
                metric={summaryStats.latestPUE}
                title="Average PUE"
                value={summaryStats.avgPUE}
                unit=""
                subtitle="Power Usage Effectiveness"
                critical={summaryStats.avgPUE > 2.0}
                status={summaryStats.avgPUE > 2.0 ? 'warning' : 'healthy'}
                icon={<Zap className="w-4 h-4 text-amber-500" />}
                timestamp={summaryStats.latestPUE?.timestamp_utc}
                assetId={summaryStats.latestPUE?.asset_id}
                region={summaryStats.latestPUE?.region}
                lineage={summaryStats.latestPUE?.lineage}
                workflowState={3}
                actions={[
                  { label: 'View Details', variant: 'secondary', onClick: () => window.location.href = '/telemetry' },
                  ...(summaryStats.avgPUE > 2.0 ? [{ label: 'Optimize', variant: 'primary', onClick: () => window.location.href = '/simulator' }] : []),
                ]}
                relatedLinks={[
                  { to: '/telemetry', label: 'View efficiency metrics →' },
                  { to: '/alerts', label: 'Check alerts →' },
                ]}
              />
            )}
            {summaryStats.avgUtilization != null && (
              <MetricPlate
                metric={summaryStats.latestUtil}
                title="Hardware Utilization"
                value={summaryStats.avgUtilization}
                unit="%"
                subtitle="Average utilization rate"
                critical={summaryStats.avgUtilization < 30}
                status={summaryStats.avgUtilization < 30 ? 'warning' : 'healthy'}
                icon={<Activity className="w-4 h-4 text-purple-500" />}
                timestamp={summaryStats.latestUtil?.timestamp_utc}
                assetId={summaryStats.latestUtil?.asset_id}
                region={summaryStats.latestUtil?.region}
                lineage={summaryStats.latestUtil?.lineage}
                workflowState={3}
                actions={[
                  { label: 'View Details', variant: 'secondary', onClick: () => window.location.href = '/telemetry' },
                ]}
                relatedLinks={[
                  { to: '/telemetry', label: 'View hardware metrics →' },
                ]}
              />
            )}
            {summaryStats.totalCarbon > 0 && (
              <MetricPlate
                metric={summaryStats.latestCarbon}
                title="Total Carbon"
                value={summaryStats.totalCarbon}
                unit="kg CO₂e"
                subtitle="Cumulative emissions"
                icon={<Cloud className="w-4 h-4 text-emerald-600" />}
                timestamp={summaryStats.latestCarbon?.timestamp_utc}
                assetId={summaryStats.latestCarbon?.asset_id}
                region={summaryStats.latestCarbon?.region}
                lineage={summaryStats.latestCarbon?.lineage}
                workflowState={3}
                trend={-5.2} // Example: would calculate from historical data
                actions={[
                  { label: 'View Breakdown', variant: 'secondary', onClick: () => window.location.href = '/telemetry' },
                  { label: 'Reduce Carbon', variant: 'primary', onClick: () => window.location.href = '/simulator' },
                ]}
                relatedLinks={[
                  { to: '/telemetry', label: 'View carbon metrics →' },
                  { to: '/compliance', label: 'Generate report →' },
                ]}
              />
            )}
            {summaryStats.totalWater > 0 && (
              <MetricPlate
                metric={summaryStats.latestWater}
                title="Total Water"
                value={summaryStats.totalWater}
                unit="L"
                subtitle="Cumulative usage"
                icon={<Droplets className="w-4 h-4 text-blue-500" />}
                timestamp={summaryStats.latestWater?.timestamp_utc}
                assetId={summaryStats.latestWater?.asset_id}
                region={summaryStats.latestWater?.region}
                lineage={summaryStats.latestWater?.lineage}
                workflowState={3}
                actions={[
                  { label: 'View Details', variant: 'secondary', onClick: () => window.location.href = '/telemetry' },
                ]}
                relatedLinks={[
                  { to: '/telemetry', label: 'View water metrics →' },
                ]}
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
