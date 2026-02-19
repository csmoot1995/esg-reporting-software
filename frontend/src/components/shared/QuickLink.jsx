import { Link } from 'react-router-dom';

export default function QuickLink({ to, title, description, icon, badge, className = '' }) {
  return (
    <Link
      to={to}
      className={`
        card p-5 hover:shadow-xl transition-all group card-hover
        hover:border-esg-sage/50 border-2 border-esg-mint/20
        ${className}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          {icon && <div className="text-2xl text-esg-sage group-hover:text-esg-forest transition-colors">{icon}</div>}
          <h3 className="font-display font-semibold text-esg-forest group-hover:text-esg-sage transition-colors">
            {title}
          </h3>
        </div>
        {badge && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-esg-mint/30 text-esg-forest">
            {badge}
          </span>
        )}
      </div>
      {description && <p className="text-sm text-esg-sage/80">{description}</p>}
      <div className="mt-3 text-xs text-esg-sage/60 group-hover:text-esg-sage transition-colors">
        View details →
      </div>
    </Link>
  );
}
