import StatusBadge from './StatusBadge';

export default function PageHeader({ title, description, status, statusLabel, isLoading, actions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-esg-forest">{title}</h2>
        {description && <p className="mt-1 text-esg-sage/90">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        {status && <StatusBadge status={status} label={statusLabel} isLoading={isLoading} />}
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
    </div>
  );
}
