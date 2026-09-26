import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext.jsx';
import { fetchStoreCategories } from '../../services/stores.js';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';

export default function StoreCategoriesPage() {
  const store = useStore();
  const [state, setState] = useState({ loading: true, categories: [], error: null });

  const load = useCallback(async () => {
    setState({ loading: true, categories: [], error: null });
    try {
      const data = await fetchStoreCategories(store.slug);
      setState({ loading: false, categories: data.categories ?? [], error: null });
    } catch (error) {
      setState({ loading: false, categories: [], error: error.message });
    }
  }, [store.slug]);

  useEffect(() => {
    load();
  }, [load]);

  const { categories } = state;

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">
          Categorías de {store.name}
        </h2>
        <p className="text-sm text-ink-500">Elegí una categoría para ver sus productos.</p>
      </div>

      {state.loading && <Spinner label="Cargando categorías…" />}

      {!state.loading && state.error && <ErrorBanner message={state.error} onRetry={load} />}

      {!state.loading && !state.error && (
        <>
          {categories.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/tienda/${store.slug}/categoria/${category.slug}`}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-ink-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
                >
                  <span className="grid gap-0.5">
                    <span className="font-bold text-ink-900 capitalize group-hover:text-brand-700">
                      {category.name}
                    </span>
                    <span className="text-sm text-ink-500">
                      {category.productCount === 1
                        ? '1 producto'
                        : `${category.productCount} productos`}
                    </span>
                  </span>
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-14 text-center text-ink-500">
              Todavía no hay categorías con productos en {store.name}. ¡Volvé pronto!
            </div>
          )}
        </>
      )}
    </div>
  );
}
