import { useCallback, useEffect, useState } from 'react';
import { fetchCategories, fetchProducts } from '../../services/products.js';
import { createProduct, deleteProduct, updateProduct } from '../../services/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatPrice } from '../../utils/format.js';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import Notice from '../../components/Notice.jsx';

const ADMIN_PAGE_SIZE = 50;

function ProductForm({ product, categories, submitting, submitError, onSubmit, onCancel }) {
  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product != null ? String(product.price) : '');
  const [stock, setStock] = useState(product != null ? String(product.stock) : '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [categoryId, setCategoryId] = useState(
    product?.categoryId != null ? String(product.categoryId) : '',
  );
  const [errors, setErrors] = useState({});

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = 'Ingresá un nombre.';
    const priceNum = Number(price);
    if (price === '' || !Number.isFinite(priceNum) || priceNum < 0) {
      nextErrors.price = 'Ingresá un precio mayor o igual a 0.';
    }
    const stockNum = Number(stock);
    if (stock === '' || !Number.isInteger(stockNum) || stockNum < 0) {
      nextErrors.stock = 'Ingresá un stock entero mayor o igual a 0.';
    }
    if (!categoryId) nextErrors.categoryId = 'Elegí una categoría.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      name: name.trim(),
      slug: slug.trim() || undefined,
      description: description.trim() || undefined,
      price: priceNum,
      stock: stockNum,
      imageUrl: imageUrl.trim() || null,
      categoryId: Number(categoryId),
    });
  };

  const inputClass =
    'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200';
  const field = (id, label, control, error) => (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink-700">
        {label}
      </label>
      {control}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-4 rounded-xl border border-ink-200 bg-white p-5 shadow-sm"
    >
      <h3 className="text-lg font-semibold text-ink-900">
        {product ? `Editar "${product.name}"` : 'Nuevo producto'}
      </h3>

      {field(
        'name',
        'Nombre *',
        <input
          id="name"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />,
        errors.name,
      )}
      {field(
        'slug',
        'Slug (opcional, se genera del nombre)',
        <input
          id="slug"
          className={inputClass}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />,
        errors.slug,
      )}
      {field(
        'description',
        'Descripción',
        <textarea
          id="description"
          rows="3"
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />,
        null,
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {field(
          'price',
          'Precio *',
          <input
            id="price"
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />,
          errors.price,
        )}
        {field(
          'stock',
          'Stock *',
          <input
            id="stock"
            type="number"
            step="1"
            min="0"
            className={inputClass}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />,
          errors.stock,
        )}
        {field(
          'categoryId',
          'Categoría *',
          <select
            id="categoryId"
            className={inputClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Seleccioná…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>,
          errors.categoryId,
        )}
      </div>
      {field(
        'imageUrl',
        'URL de imagen',
        <input
          id="imageUrl"
          type="url"
          className={inputClass}
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />,
        null,
      )}

      {submitError && <Notice type="error">{submitError}</Notice>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
        >
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-ink-200 px-5 py-2 text-sm text-ink-600 transition hover:bg-ink-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function StockEditor({ product, onSave }) {
  const [value, setValue] = useState(String(product.stock));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const stockNum = Number(value);
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      setError('Entero ≥ 0.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(stockNum);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        step="1"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-20 rounded-lg border border-ink-200 px-2 py-1.5 text-sm outline-none transition focus:border-brand-500"
        aria-label={`Cambiar stock de ${product.name}`}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-ink-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-ink-900 disabled:cursor-not-allowed disabled:bg-ink-300"
      >
        {saving ? '…' : 'Cambiar'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export default function AdminProducts() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [state, setState] = useState({ loading: true, error: null });
  const [formProduct, setFormProduct] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setState({ loading: true, error: null });
    try {
      const data = await fetchProducts({ search, limit: ADMIN_PAGE_SIZE });
      setProducts(data.products);
      setState({ loading: false, error: null });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }, [search]);

  const loadCategories = useCallback(async () => {
    try {
      const data = await fetchCategories();
      setCategories(data.categories ?? []);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openCreate = () => {
    setFormProduct(null);
    setFormOpen(true);
    setSubmitError('');
  };

  const openEdit = (product) => {
    setFormProduct(product);
    setFormOpen(true);
    setSubmitError('');
  };

  const handleSubmit = async (body) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      if (formProduct) {
        await updateProduct(token, formProduct.id, body);
        setNotice({ type: 'success', text: `"${body.name ?? formProduct.name}" actualizado.` });
      } else {
        await createProduct(token, body);
        setNotice({ type: 'success', text: `Producto "${body.name}" creado.` });
      }
      setFormOpen(false);
      setFormProduct(null);
      await load();
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`¿Eliminar el producto "${product.name}"?`)) return;
    try {
      await deleteProduct(token, product.id);
      setNotice({ type: 'success', text: `Producto "${product.name}" eliminado.` });
      await load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  const handleStockSave = async (product, stock) => {
    await updateProduct(token, product.id, { stock });
    setNotice({ type: 'success', text: `Stock de "${product.name}" actualizado a ${stock}.` });
    await load();
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink-900">Productos</h2>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          + Nuevo producto
        </button>
      </div>

      {notice && <Notice type={notice.type}>{notice.text}</Notice>}

      {formOpen && (
        <ProductForm
          product={formProduct}
          categories={categories}
          submitting={submitting}
          submitError={submitError}
          onSubmit={handleSubmit}
          onCancel={() => {
            setFormOpen(false);
            setFormProduct(null);
            setSubmitError('');
          }}
        />
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          load();
        }}
        className="flex gap-2"
      >
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o descripción…"
          className="w-full max-w-md rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
        >
          Buscar
        </button>
      </form>

      {state.loading && <Spinner label="Cargando productos…" />}

      {!state.loading && state.error && <ErrorBanner message={state.error} onRetry={load} />}

      {!state.loading && !state.error && (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-ink-100 text-xs uppercase tracking-wide text-ink-600">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {products.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-ink-500">
                    No hay productos que coincidan.
                  </td>
                </tr>
              )}
              {products.map((product) => (
                <tr key={product.id} className="transition hover:bg-brand-50/50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink-900">{product.name}</span>
                    <span className="block text-xs text-ink-400">
                      #{product.id} · /{product.slug}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {categories.find((category) => category.id === product.categoryId)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink-900">
                    {formatPrice(product.price)}
                  </td>
                  <td className="px-4 py-3">
                    <StockEditor
                      product={product}
                      onSave={(stock) => handleStockSave(product, stock)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(product)}
                        className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
