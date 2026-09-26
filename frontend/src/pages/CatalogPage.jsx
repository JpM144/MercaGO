import { useCallback, useEffect, useState } from 'react';
import { fetchCategories, fetchProducts } from '../services/products.js';
import ProductCard from '../components/ProductCard.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Más nuevos' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
];

export default function CatalogPage() {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    fetchCategories()
      .then((res) => setCategories(res.categories ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const data = await fetchProducts({ category, search, sort, page, limit: PAGE_SIZE });
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [category, search, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const selectCategory = (value) => {
    setCategory(value);
    setPage(1);
  };

  const changeSort = (value) => {
    setSort(value);
    setPage(1);
  };

  const hasProducts = state.data && state.data.products.length > 0;

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Catálogo</h1>
        <p className="text-ink-500">Todos los productos de las tiendas, en un solo lugar.</p>
      </div>

      <div className="grid gap-4 rounded-xl border border-ink-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar productos…"
            aria-label="Buscar productos"
            className="w-full rounded-lg border border-ink-200 px-4 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Buscar
          </button>
        </form>

        <label className="flex items-center gap-2 text-sm text-ink-600">
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
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selectCategory('')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            category === ''
              ? 'bg-brand-600 text-white'
              : 'bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-brand-50'
          }`}
        >
          Todos
        </button>
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectCategory(item.slug)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
              category === item.slug
                ? 'bg-brand-600 text-white'
                : 'bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-brand-50'
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>

      {state.loading && <Spinner label="Cargando el catálogo…" />}

      {!state.loading && state.error && <ErrorBanner message={state.error} onRetry={load} />}

      {!state.loading && !state.error && (
        <>
          {hasProducts ? (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {state.data.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:text-ink-300"
                >
                  Anterior
                </button>
                <p className="text-sm text-ink-500">
                  Página {state.data.page} de {state.data.totalPages} · {state.data.total} productos
                </p>
                <button
                  type="button"
                  disabled={page >= state.data.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:text-ink-300"
                >
                  Siguiente
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-16 text-center text-ink-500">
              No hay productos que coincidan con los filtros. Probá borrar la búsqueda o cambiar de
              categoría.
            </div>
          )}
        </>
      )}
    </div>
  );
}
