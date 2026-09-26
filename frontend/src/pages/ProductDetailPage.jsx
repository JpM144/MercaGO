import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchProductBySlug } from '../services/products.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatPrice } from '../utils/format.js';
import Spinner from '../components/Spinner.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import ReviewList from '../components/ReviewList.jsx';
import ReviewForm from '../components/ReviewForm.jsx';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const { addItem } = useCart();
  const { token, user } = useAuth();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [added, setAdded] = useState(false);
  const [postedReviews, setPostedReviews] = useState([]);

  const load = useCallback(async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const data = await fetchProductBySlug(slug);
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddToCart = () => {
    addItem(state.data.product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  if (state.loading) {
    return <Spinner label="Cargando el producto…" />;
  }

  if (state.error) {
    return (
      <div className="grid gap-4">
        <ErrorBanner message={state.error} onRetry={load} />
        <Link to="/" className="text-sm font-medium text-brand-700 hover:text-brand-800">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  const product = state.data.product;
  const reviews = [...postedReviews, ...(state.data.reviews ?? [])];
  const ratingCount = reviews.length;
  const ratingAverage = ratingCount
    ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / ratingCount) * 10) / 10
    : null;
  const alreadyReviewed = token ? reviews.some((review) => review.user?.id === user?.id) : false;
  const outOfStock = product.stock <= 0;

  const handleReviewCreated = (review) => {
    setPostedReviews((previous) => [review, ...previous]);
  };

  return (
    <div className="grid gap-8">
      <Link to="/" className="text-sm font-medium text-brand-700 hover:text-brand-800">
        ← Volver al catálogo
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-ink-50 shadow-sm">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-8xl font-black text-ink-300">{product.name.charAt(0)}</span>
          )}
        </div>

        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            {product.category && (
              <span className="w-fit rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-800">
                {product.category.name}
              </span>
            )}
            <h1 className="text-3xl font-bold tracking-tight text-ink-900">{product.name}</h1>
            {product.description && <p className="text-ink-600">{product.description}</p>}
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-brand-800">{formatPrice(product.price)}</span>
            <span
              className={
                outOfStock
                  ? 'text-sm font-medium text-red-500'
                  : 'text-sm font-medium text-emerald-600'
              }
            >
              {outOfStock ? 'Sin stock' : `${product.stock} unidades disponibles`}
            </span>
          </div>

          <div className="flex items-center gap-2 text-ink-600">
            <span className="text-accent-500" aria-hidden="true">
              {'★'.repeat(Math.round(ratingAverage ?? 0))}
              <span className="text-ink-200">{'★'.repeat(5 - Math.round(ratingAverage ?? 0))}</span>
            </span>
            <span className="text-sm">
              {ratingAverage ?? 'Sin reseñas'}
              {ratingCount != null && ratingCount > 0 && (
                <>
                  {' '}
                  · {ratingCount} reseña{ratingCount === 1 ? '' : 's'}
                </>
              )}
            </span>
          </div>

          <button
            type="button"
            disabled={outOfStock}
            onClick={handleAddToCart}
            className={`mt-2 rounded-xl px-6 py-3 text-sm font-semibold transition ${
              outOfStock
                ? 'cursor-not-allowed bg-ink-100 text-ink-400'
                : added
                  ? 'bg-emerald-600 text-white'
                  : 'bg-accent-500 text-brand-950 hover:bg-accent-400'
            }`}
          >
            {outOfStock ? 'Sin stock' : added ? 'Agregado al carrito' : 'Agregar al carrito'}
          </button>
        </div>
      </div>

      <section className="grid gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-ink-900">Reseñas</h2>
          <span className="text-sm text-ink-500">
            {ratingCount > 0
              ? `${ratingAverage} de 5 · ${ratingCount} reseña${ratingCount === 1 ? '' : 's'}`
              : 'Sin reseñas todavía'}
          </span>
        </div>

        {token ? (
          <ReviewForm
            productId={product.id}
            alreadyReviewed={alreadyReviewed}
            onReviewCreated={handleReviewCreated}
          />
        ) : (
          <div className="rounded-xl border border-ink-200 bg-white p-5 text-sm text-ink-600 shadow-sm">
            ¿Ya compraste este producto?{' '}
            <Link
              to="/login"
              state={{ from: `/products/${product.slug}` }}
              className="font-medium text-brand-700 hover:text-brand-800"
            >
              Ingresá
            </Link>{' '}
            para dejar tu reseña.
          </div>
        )}

        <ReviewList reviews={reviews} />
      </section>
    </div>
  );
}
