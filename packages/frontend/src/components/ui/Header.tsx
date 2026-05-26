import { Link, useLocation } from 'react-router-dom';

export function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <header className="border-b border-border bg-surface-raised px-6 py-3 flex items-center gap-4">
      <Link to="/" className="text-lg font-bold text-white tracking-tight hover:text-accent transition-colors">
        Proveit
      </Link>
      {!isHome && (
        <span className="text-muted text-sm">
          <Link to="/" className="hover:text-gray-300 transition-colors">
            All POCs
          </Link>
          {' / '}
          <span className="text-gray-300">Current</span>
        </span>
      )}
    </header>
  );
}
