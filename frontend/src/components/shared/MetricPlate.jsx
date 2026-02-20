import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronDown, ChevronUp, ExternalLink, Clock, Server, Globe, 
  Activity, CheckCircle2, AlertCircle, Info, MoreHorizontal,
  TrendingUp, TrendingDown, Minus
} from 'lucide-react';

const STATUS_STEPS = ['raw', 'validated', 'processed', 'alerting'];

export default function MetricPlate({ 
  metric,
  title,
  value,
  unit,
  subtitle,
  trend,
  critical,
  icon,
  onClick,
  className = '',
  actions = [],
  expandable = true,
  lineage = null,
  timestamp = null,
  assetId = null,
  region = null,
  status = null,
  details = null,
  relatedLinks = [],
  workflowState = null,
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeStep, setActiveStep] = useState(workflowState || 0);
  const displayValue = value != null ? (typeof value === 'number' ? value.toFixed(2) : value) : 'N/A';
  
  const hasDetails = lineage || timestamp || assetId || region || details;
  const canExpand = expandable && hasDetails;

  const getTrendIcon = () => {
    if (trend == null) return <Minus className="w-3 h-3" />;
    if (trend > 0) return <TrendingUp className="w-3 h-3" />;
    if (trend < 0) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const getTrendColor = () => {
    if (trend == null) return 'text-esg-sage/60';
    // For metrics where lower is better (carbon, water consumption)
    const lowerIsBetter = title?.toLowerCase().includes('carbon') || 
                         title?.toLowerCase().includes('water') ||
                         metric?.metric_type?.includes('carbon');
    if (lowerIsBetter) {
      return trend > 0 ? 'text-esg-alert' : 'text-esg-success';
    }
    return trend > 0 ? 'text-esg-success' : 'text-esg-alert';
  };

  return (
    <div
      className={`
        rounded-xl border-2 overflow-hidden transition-all duration-200
        ${critical ? 'border-esg-alert bg-red-50' : 'border-esg-mint/30 bg-white'}
        ${onClick || canExpand ? 'cursor-pointer hover:shadow-lg hover:border-esg-sage/50' : ''}
        ${className}
      `}
    >
      {/* Main Card Content */}
      <div 
        className="p-4"
        onClick={() => canExpand && setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon && <div className="text-esg-sage/60">{icon}</div>}
            <div className="text-sm font-medium text-esg-forest">{title}</div>
          </div>
          <div className="flex items-center gap-2">
            {status && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                status === 'healthy' ? 'bg-green-100 text-green-700' :
                status === 'warning' ? 'bg-amber-100 text-amber-700' :
                status === 'critical' ? 'bg-red-100 text-red-700' :
                'bg-esg-mint/30 text-esg-sage'
              }`}>
                {status}
              </span>
            )}
            {canExpand && (
              <button 
                className="p-1 hover:bg-esg-mint/30 rounded transition-colors"
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              >
                {expanded ? <ChevronUp className="w-4 h-4 text-esg-sage" /> : <ChevronDown className="w-4 h-4 text-esg-sage" />}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-display font-bold ${critical ? 'text-esg-alert' : 'text-esg-sage'}`}>
            {displayValue}
          </span>
          {unit && <span className="text-esg-sage/80 text-sm">{unit}</span>}
        </div>

        {/* Subtitle with metadata chips */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {subtitle && <div className="text-xs text-esg-sage/70">{subtitle}</div>}
          
          {timestamp && (
            <div className="flex items-center gap-1 text-xs text-esg-sage/60 bg-esg-cream/50 px-2 py-0.5 rounded">
              <Clock className="w-3 h-3" />
              {new Date(timestamp).toLocaleTimeString()}
            </div>
          )}
          
          {assetId && (
            <div className="flex items-center gap-1 text-xs text-esg-sage/60 bg-esg-cream/50 px-2 py-0.5 rounded">
              <Server className="w-3 h-3" />
              {assetId.replace(/_/g, ' ')}
            </div>
          )}
          
          {region && (
            <div className="flex items-center gap-1 text-xs text-esg-sage/60 bg-esg-cream/50 px-2 py-0.5 rounded">
              <Globe className="w-3 h-3" />
              {region.replace(/_/g, ' ')}
            </div>
          )}
        </div>

        {/* Trend indicator */}
        {trend != null && (
          <div className={`flex items-center gap-1 text-xs mt-2 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span>{Math.abs(trend).toFixed(1)}% vs last period</span>
          </div>
        )}

        {/* Quick Actions Row */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-esg-mint/20">
            {actions.map((action, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                disabled={action.disabled}
                className={`
                  text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
                  ${action.variant === 'primary' 
                    ? 'bg-esg-forest text-white hover:bg-esg-forest/90' 
                    : action.variant === 'danger'
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-esg-mint/30 text-esg-forest hover:bg-esg-mint/50'}
                  ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {action.icon && <span className="mr-1">{action.icon}</span>}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Details Section */}
      {expanded && hasDetails && (
        <div className="border-t border-esg-mint/30 bg-esg-cream/20">
          {/* Workflow Stepper */}
          {workflowState !== null && (
            <div className="px-4 py-3 border-b border-esg-mint/20">
              <div className="text-xs font-medium text-esg-forest mb-2">Processing Pipeline</div>
              <div className="flex items-center">
                {STATUS_STEPS.map((step, i) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`
                        flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                        ${i < activeStep ? 'bg-esg-success text-white' : ''}
                        ${i === activeStep ? 'bg-esg-sage text-white' : ''}
                        ${i > activeStep ? 'bg-esg-mint/30 text-esg-sage/50' : ''}
                      `}
                    >
                      {i < activeStep ? '✓' : i + 1}
                    </div>
                    <span className={`ml-1.5 text-xs ${i <= activeStep ? 'text-esg-forest' : 'text-esg-sage/50'}`}>
                      {step.charAt(0).toUpperCase() + step.slice(1)}
                    </span>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`w-6 h-0.5 mx-1 ${i < activeStep ? 'bg-esg-success' : 'bg-esg-mint/30'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lineage Information */}
          {lineage && (
            <div className="px-4 py-3 border-b border-esg-mint/20">
              <div className="text-xs font-medium text-esg-forest mb-2">Data Lineage</div>
              <div className="space-y-1 text-xs text-esg-sage/80">
                {lineage.source_id && (
                  <div className="flex justify-between">
                    <span>Source:</span>
                    <span className="font-medium">{lineage.source_id.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {lineage.emission_factor_version && (
                  <div className="flex justify-between">
                    <span>EF Version:</span>
                    <span className="font-medium">{lineage.emission_factor_version.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {lineage.calculation_step && (
                  <div className="flex justify-between">
                    <span>Calculation:</span>
                    <span className="font-medium">{lineage.calculation_step.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {lineage.computed_at && (
                  <div className="flex justify-between">
                    <span>Computed:</span>
                    <span className="font-medium">{new Date(lineage.computed_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Additional Details */}
          {details && (
            <div className="px-4 py-3 border-b border-esg-mint/20">
              <div className="text-xs font-medium text-esg-forest mb-2">Details</div>
              <div className="space-y-1 text-xs text-esg-sage/80">
                {Object.entries(details).map(([key, val]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="font-medium">
                      {typeof val === 'number' ? val.toFixed(2) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Links */}
          {relatedLinks.length > 0 && (
            <div className="px-4 py-3">
              <div className="text-xs font-medium text-esg-forest mb-2">Related</div>
              <div className="space-y-1">
                {relatedLinks.map((link, idx) => (
                  <Link
                    key={idx}
                    to={link.to}
                    className="flex items-center gap-1 text-xs text-esg-sage hover:text-esg-forest hover:underline"
                  >
                    {link.icon || <ExternalLink className="w-3 h-3" />}
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
