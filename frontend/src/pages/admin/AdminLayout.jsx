import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import StorePlanBanner from '../../components/StorePlanBanner.jsx';

const LINKS = [
  { to: '/admin/products', label: 'Productos' },
  { to: '/admin/categories', label: 'Categorías' },
  { to: '/admin/plan', label: 'Mi plan' },
  { to: '/admin/reports', label: 'Informes' },
  { to: '/admin/sales-assistant', label: 'Asistente de ventas' },
];

export default function AdminLayout() {
  const { user } = useAuth();

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr] lg:items-start">
      <aside className="grid gap-1 rounded-xl border border-ink-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
        <div className="mb-2 grid gap-1 border-b border-ink-100 pb-3">
          <h1 className="text-lg font-bold text-ink-900">Panel admin</h1>
          <p className="truncate text-xs text-ink-500">Administrador: {user?.name}</p>
        </div>
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-700 hover:bg-brand-50 hover:text-brand-800'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
        <Link
          to="/"
          className="mt-3 rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-600 transition hover:bg-ink-50"
        >
          ← Volver a la tienda
        </Link>
      </aside>
      <div className="grid min-w-0 gap-6">
        <StorePlanBanner />
        <Outlet />
      </div>
    </div>
  );
}
