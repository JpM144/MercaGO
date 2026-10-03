import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicStores } from '../services/stores.js';
import Spinner from '../components/Spinner.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

export default function StoresDirectoryPage() {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  const load = useCallback(async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const data = await fetchPublicStores();
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stores = state.data?.stores ?? [];

  return (
    <div className="grid gap-8">
      <div className="grid gap-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Tiendas</h1>
        <p className="text-ink-500">
          {state.data
            ? `${stores.length === 1 ? '1 tienda activa' : `${stores.length} tiendas activas`} vendiendo en la plataforma.`
            : 'Tiendas activas en la plataforma.'}
        </p>
      </div>

      {state.loading && <Spinner label="Cargando tiendas…" />}

      {!state.loading && state.error && <ErrorBanner message={state.error} onRetry={load} />}

      {!state.loading && !state.error && (
        <>
          {stores.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stores.map((store) => (
                <Link
                  key={store.id}
                  to={`/tienda/${store.slug}`}
                  className="group grid gap-4 rounded-xl border border-ink-200 bg-white p-6 shadow-sm transition hover:border-brand-300 hover:shadow-md"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600 text-2xl font-black text-white transition group-hover:bg-brand-700">
                    {store.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="grid gap-1">
                    <span className="text-lg font-bold text-ink-900">{store.name}</span>
                    <span className="text-sm text-ink-500">
                      {store.productCount === 1 ? '1 producto' : `${store.productCount} productos`}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-brand-700 transition group-hover:text-brand-800">
                    Ver tienda →
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-16 text-center text-ink-500">
              Todavía no hay tiendas activas en la plataforma. ¡Puedes ser la primera!
            </div>
          )}

          <div className="grid gap-3 rounded-xl border border-brand-200 bg-brand-50 p-6 text-center">
            <h2 className="text-lg font-bold text-ink-900">¿Tienes un negocio?</h2>
            <p className="text-sm text-ink-600">
              Registra tu tienda y empieza a vender en el marketplace. Revisamos tu solicitud y te
              avisamos cuando esté aprobada.
            </p>
            <Link
              to="/registrar"
              className="mx-auto rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-brand-950 transition hover:bg-accent-400"
            >
              Abrir mi tienda
            </Link>
          </div>
        </>
      )}
    </div>
  );
}