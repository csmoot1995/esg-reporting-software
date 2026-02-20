export default function MetricCard({ title, value, unit, subtitle, trend, critical, icon, onClick, className = '', expandable = false, expanded = false, children }) {
  const displayValue = value != null ? (typeof value === 'number' ? value.toFixed(2) : value) : 'N/A';
  
  return (
    <div
      className={`
        rounded-xl border-2 p-4 transition-all
        ${critical ? 'border-esg-alert bg-red-50' : 'border-esg-mint/30 bg-white'}
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:border-esg-sage/50 card-hover' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="text-sm font-medium text-esg-forest">{title}</div>
        {icon && <div className="text-esg-sage/60">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-display font-bold ${critical ? 'text-esg-alert' : 'text-esg-sage'}`}>
          {displayValue}
        </span>
        {unit && <span className="text-esg-sage/80">{unit}</span>}
      </div>
      {subtitle && <div className="text-xs text-esg-sage/70 mt-1">{subtitle}</div>}
      {trend != null && (
        <div className={`text-xs mt-1 ${trend > 0 ? 'text-esg-alert' : 'text-esg-success'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}

      {expandable && expanded && children && (
        <div className="mt-3 pt-3 border-t border-esg-mint/30">
          {children}
        </div>
      )}
    </div>
  );
}
