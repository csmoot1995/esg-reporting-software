import { NavLink, useLocation } from 'react-router-dom';

const navClass = ({ isActive }) =>
  `px-4 py-2.5 rounded-lg font-semibold transition-all border-2 ${
    isActive
      ? 'bg-esg-sage text-white border-esg-sage shadow'
      : 'text-esg-cream border-esg-sage/50 hover:bg-esg-mint/40 hover:border-esg-mint'
  }`;

export default function Layout({ children }) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col bg-esg-cream">
      <header className="bg-esg-forest text-esg-cream shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <NavLink to="/" className="font-display text-xl font-bold tracking-tight hover:text-esg-mint transition-colors">
              ESG Platform
            </NavLink>
            <nav className="flex gap-2 flex-wrap">
              <NavLink to="/" className={navClass}>
                Dashboard
              </NavLink>
              <NavLink to="/telemetry" className={navClass}>
                Telemetry
              </NavLink>
              <NavLink to="/compliance" className={navClass}>
                Compliance
              </NavLink>
              <NavLink to="/alerts" className={navClass}>
                Alerts
              </NavLink>
              <NavLink to="/simulator" className={navClass}>
                Simulator
              </NavLink>
            </nav>
          </div>
          {!isHome && (
            <div className="text-xs text-esg-cream/70 flex items-center gap-2">
              <NavLink to="/" className="hover:text-esg-cream transition-colors">
                Dashboard
              </NavLink>
              <span>/</span>
              <span className="capitalize">{location.pathname.slice(1)}</span>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="bg-esg-forest/95 text-esg-cream/70 py-4 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          ESG Platform — AI Data Center Sustainability Monitoring
        </div>
      </footer>
    </div>
  );
}
