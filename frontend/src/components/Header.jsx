import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Header() {
  const { appName } = useApp();
  const { user, logout } = useAuth();
  const { totalCount } = useCart();

  const isStoreAdmin = user?.role === 'store_admin';
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const storePanelTo = isSuperAdmin
    ? '/super-admin'
    : isStoreAdmin && user.storeStatus !== 'approved'
      ? '/estado-tienda'
      : '/admin';

  return (
    <header className="sticky top-0 z-10 border-b border-brand-900/40 bg-brand-950 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500 text-sm font-black text-brand-950">
            T
          </span>
          <span className="text-xl font-bold tracking-tight">{appName}</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="text-brand-100 transition hover:text-white">
            Tiendas
          </Link>
          <Link to="/catalogo" className="text-brand-100 transition hover:text-white">
            Catálogo
          </Link>
          {(isSuperAdmin || isAdmin || isStoreAdmin) && (
            <Link
              to={storePanelTo}
              className="rounded-lg bg-brand-900/60 px-3 py-2 font-medium text-accent-300 transition hover:text-accent-200"
            >
              {isSuperAdmin ? 'Super admin' : isAdmin ? 'Panel admin' : 'Mi tienda'}
            </Link>
          )}
          <Link
            to="/cart"
            className="relative flex items-center gap-2 rounded-lg bg-brand-900/60 px-4 py-2 font-medium text-brand-100 transition hover:text-white"
            aria-label={`Carrito con ${totalCount} ítems`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19h11.8M11 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              />
            </svg>
            Carrito
            {totalCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-xs font-bold text-brand-950">
                {totalCount}
              </span>
            )}
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="max-w-32 truncate text-brand-100">Hola, {user.name}</span>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-brand-800 px-3 py-2 text-brand-100 transition hover:bg-brand-900 hover:text-white"
              >
                Salir
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-lg bg-brand-900/60 px-4 py-2 font-medium text-brand-100 transition hover:text-white"
            >
              Ingresar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
