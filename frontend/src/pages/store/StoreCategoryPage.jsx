import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../../context/StoreContext.jsx';
import { fetchStoreCategories, fetchStoreProducts } from '../../services/stores.js';
import ProductGrid from '../../components/ProductGrid.jsx';
import Paginator from '../../components/Paginator.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Más nuevos' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
];

export default function StoreCategoryPage() {
  const store = useStore();
  const { nombre } = useParams();
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [allCategories, setAllCategories] = useState([]);
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    // Las categorías son privadas: el título se resuelve con el catálogo de esta tienda.
    fetchStoreCategories(store.slug)
      .then((res) => setAllCategories(res.categories ?? []))
      .catch(() => {});
  }, [store.slug]);

  const load = useCallback(async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const data = await fetchStoreProducts({
        slug: store.slug,
        category: nombre,
        sort,
        page,
        limit: PAGE_SIZE,
      });
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [store.slug, nombre, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  const changeSort = (value) => {
    setSort(value);
    setPage(1);
  };

  const firstProduct = state.data?.products?.[0];
  const categoryName =
    firstProduct?.category?.name ??
    allCategories.find((category) => category.slug === nombre)?.name ??
    nombre;

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <Link
          to={`/tienda/${store.slug}/categorias`}
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← Categorías
        </Link>
        <h2 className="text-2xl font-bold tracking-tight capitalize text-ink-900">
          {categoryName}
        </h2>
        <p className="text-sm text-ink-500">
          Productos de {categoryName} en {store.name}.
        </p>
      </div>

      <label className="flex items-center justify-end gap-2 text-sm text-ink-600">
        Ordenar
        <select
          value={sort}
          onChange={(event) => changeSort(event.target.value)}
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {state.loading && <Spinner label="Cargando productos…" />}

      {!state.loading && state.error && <ErrorBanner message={state.error} onRetry={load} />}

      {!state.loading && !state.error && (
        <>
          <ProductGrid
            products={state.data.products}
            emptyMessage={`Todavía no hay productos publicados en ${categoryName}. ¡Volvé pronto!`}
          />
          <Paginator
            page={state.data.page}
            totalPages={state.data.totalPages}
            total={state.data.total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
