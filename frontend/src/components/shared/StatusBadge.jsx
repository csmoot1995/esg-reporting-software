export default function StatusBadge({ status, label, isLoading }) {
  const statusConfig = {
    loading: {
      bg: 'bg-esg-mint/30',
      text: 'text-esg-forest',
      dot: 'animate-pulse bg-esg-sage',
      label: 'Checking…',
    },
    error: {
      bg: 'bg-red-100',
      text: 'text-esg-alert',
      dot: 'bg-esg-alert',
      label: 'Service offline',
    },
    success: {
      bg: 'bg-esg-success/20',
      text: 'text-esg-success',
      dot: 'bg-esg-success',
      label: 'Service connected',
    },
  };

  const config = isLoading
    ? statusConfig.loading
    : status === 'error'
      ? statusConfig.error
      : statusConfig.success;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${config.bg} ${config.text}`}>
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {label || config.label}
    </span>
  );
}
