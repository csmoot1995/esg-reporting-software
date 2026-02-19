import { Link } from 'react-router-dom';

export default function ContextualPanel({ title, items, className = '' }) {
  if (!items || items.length === 0) return null;

  return (
    <div className={`card p-4 bg-esg-mint/10 border-l-4 border-esg-sage ${className}`}>
      {title && <h4 className="font-semibold text-esg-forest mb-2 text-sm">{title}</h4>}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="text-sm text-esg-sage/90">
            {item.icon && <span className="mr-2">{item.icon}</span>}
            {item.link ? (
              <Link to={item.link} className="text-esg-sage hover:underline font-medium">
                {item.text} →
              </Link>
            ) : (
              <span>{item.text}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
