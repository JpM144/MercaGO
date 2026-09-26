import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { fetchStoreProducts } from '../../services/stores.js';
import ProductGrid from '../../components/ProductGrid.jsx';
import Paginator from '../../components/Paginator.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';

const PAGE_SIZE = 12;

export default function StoreSearchPage() {
  const store = useStore();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, data: null, error: null });

  const load = useCallback(async () => {
    if (!submitted) {
      setState({ loading: false, data: null, error: null });
      return;
    }
    setState({ loading: true, data: null, error: null });
    try {
      const data = await fetchStoreProducts({
        slug: store.slug,
        search: submitted,
        page,
        limit: PAGE_SIZE,
      });
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [store.slug, submitted, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(query.trim());
    setPage(1);
  };

  const hasResults = state.data && state.data.products.length > 0;

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">Buscar en {store.name}</h2>
        <p className="text-sm text-ink-500">Encontrá productos por nombre o descripción.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ej.: cargador, funda, audífonos…"
          aria-label="Buscar productos en esta tienda"
          className="w-full rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Buscar
        </button>
      </form>

      {state.loading && <Spinner label="Buscando productos…" />}

      {!state.loading && state.error && <ErrorBanner message={state.error} onRetry={load} />}

      {!state.loading && !state.error && !submitted && (
        <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-14 text-center text-ink-500">
          Escribí una búsqueda para encontrar productos en {store.name}.
        </div>
      )}

      {!state.loading && !state.error && submitted && (
        <>
          <ProductGrid
            products={state.data?.products ?? []}
            emptyMessage={`No encontramos productos que coincidan con «${submitted}». Probá con otros términos.`}
          />
          {hasResults && (
            <Paginator
              page={state.data.page}
              totalPages={state.data.totalPages}
              total={state.data.total}
              label={`${state.data.total} resultados para «${submitted}»`}
              onPage={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
