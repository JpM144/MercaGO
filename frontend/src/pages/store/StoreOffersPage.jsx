import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { fetchStoreProducts } from '../../services/stores.js';
import ProductGrid from '../../components/ProductGrid.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';

export default function StoreOffersPage() {
  const store = useStore();
  const [state, setState] = useState({ loading: true, data: null, error: null });

  const load = useCallback(async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const data = await fetchStoreProducts({ slug: store.slug, onSale: 'true', limit: 50 });
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [store.slug]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">Ofertas</h2>
        <p className="text-sm text-ink-500">Productos con descuento activo en {store.name}.</p>
      </div>

      {state.loading && <Spinner label="Buscando ofertas…" />}

      {!state.loading && state.error && <ErrorBanner message={state.error} onRetry={load} />}

      {!state.loading && !state.error && (
        <ProductGrid
          products={state.data.products}
          emptyMessage="No hay ofertas activas en este momento. ¡Vuelve pronto!"
        />
      )}
    </div>
  );
}
