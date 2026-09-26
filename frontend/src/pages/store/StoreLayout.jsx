import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { StoreProvider } from '../../context/StoreContext.jsx';
import { fetchPublicStore } from '../../services/stores.js';
import Spinner from '../../components/Spinner.jsx';
import StoreWhatsAppButton from '../../components/StoreWhatsAppButton.jsx';

const NAV_ITEMS = [
  { to: '', label: 'Inicio', end: true },
  { to: '/categorias', label: 'Categorías' },
  { to: '/ofertas', label: 'Ofertas' },
  { to: '/buscar', label: 'Buscar' },
  { to: '/favoritos', label: 'Favoritos' },
  { to: '/ayuda', label: 'Ayuda' },
];

export function StoreNotFoundView({ message }) {
  return (
    <div className="mx-auto grid w-full max-w-lg gap-5 py-20 text-center">
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ink-100 text-3xl font-black text-ink-400"
        aria-hidden="true"
      >
        ?
      </div>
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Tienda no encontrada</h1>
        <p className="text-ink-500">
          {message ??
            'Esta tienda no existe o todavía no está aprobada. Probá volver al marketplace y elegir otra tienda.'}
        </p>
      </div>
      <Link
        to="/"
        className="mx-auto rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        Volver al marketplace
      </Link>
    </div>
  );
}

export default function StoreLayout() {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true, store: null, error: null });

  const load = useCallback(async () => {
    setState({ loading: true, store: null, error: null });
    try {
      const data = await fetchPublicStore(slug);
      setState({ loading: false, store: data.store, error: null });
    } catch (error) {
      setState({ loading: false, store: null, error: error.message });
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.loading) {
    return <Spinner label="Cargando tienda…" />;
  }

  if (state.error || !state.store) {
    return <StoreNotFoundView message={state.error} />;
  }

  const store = state.store;
  const base = `/tienda/${store.slug}`;

  return (
    <StoreProvider store={store}>
      <div className="grid gap-8">
        <header className="grid gap-5 overflow-hidden rounded-2xl bg-brand-950 text-white shadow-sm">
          <div className="grid gap-4 border-b border-brand-900/50 p-6 md:flex md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-3xl font-black text-brand-950">
                {store.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight">{store.name}</h1>
                <p className="truncate text-sm text-brand-200">
                  {store.productCount === 1
                    ? '1 producto publicado'
                    : `${store.productCount} productos publicados`}
                </p>
              </div>
            </div>
            <Link
              to="/"
              className="shrink-0 rounded-lg bg-brand-900/60 px-4 py-2 text-sm font-medium text-brand-100 transition hover:bg-brand-900 hover:text-white"
            >
              ← Volver al marketplace
            </Link>
          </div>
          <nav className="flex flex-wrap items-center gap-1 px-4 pb-4">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.label}
                to={item.to === '' ? base : `${base}${item.to}`}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-accent-500 text-brand-950'
                      : 'text-brand-100 hover:bg-brand-900/60 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="grid gap-8">
          <Outlet />
        </main>

        <StoreWhatsAppButton phone={store.whatsappNumber} name={store.name} />
      </div>
    </StoreProvider>
  );
}
