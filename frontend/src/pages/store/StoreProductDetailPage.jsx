import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchProductBySlug } from '../../services/products.js';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { formatPrice, formatDate } from '../../utils/format.js';
import { buildPurchaseMessage, buildWhatsAppHref } from '../../utils/whatsapp.js';
import { productHref } from '../../utils/links.js';
import FavoriteButton from '../../components/FavoriteButton.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import ReviewList from '../../components/ReviewList.jsx';
import ReviewForm from '../../components/ReviewForm.jsx';

function clampQuantity(value, stock) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(Math.floor(value), Math.max(1, stock)));
}

function TrustBadges({ store }) {
  const badges = [
    {
      icon: '🛡️',
      title: 'Compra segura',
      description: store.paymentMethods ?? 'Pagá de forma segura con los métodos que prefieras.',
    },
    {
      icon: '🚚',
      title: 'Envío a todo el país',
      description: store.shippingInfo ?? 'Hacemos envíos a todo el país. Consultá los tiempos.',
    },
    {
      icon: '🧾',
      title: 'Garantía',
      description: store.warrantyInfo ?? 'Productos con garantía. Consultá las condiciones.',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {badges.map((badge) => (
        <div key={badge.title} className="grid gap-1 rounded-xl border border-ink-200 bg-white p-4">
          <span className="text-xl" aria-hidden="true">
            {badge.icon}
          </span>
          <h3 className="text-sm font-bold text-ink-900">{badge.title}</h3>
          <p className="text-xs text-ink-500">{badge.description}</p>
        </div>
      ))}
    </div>
  );
}

export default function StoreProductDetailPage() {
  const { productSlug } = useParams();
  const { addItem } = useCart();
  const { token, user } = useAuth();
  const store = useStore();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [postedReviews, setPostedReviews] = useState([]);

  const load = useCallback(async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const data = await fetchProductBySlug(productSlug);
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [productSlug]);

  useEffect(() => {
    setQuantity(1);
    load();
  }, [load]);

  const product = state.data?.product;
  const seller = product?.store ?? store;
  const storeSlug = seller?.slug ?? store?.slug;

  const handleAddToCart = () => {
    addItem(product, quantity);
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
        <Link
          to={`/tienda/${store?.slug ?? ''}`}
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← Volver a la tienda
        </Link>
      </div>
    );
  }

  const reviews = [...postedReviews, ...(state.data.reviews ?? [])];
  const ratingCount = reviews.length;
  const ratingAverage = ratingCount
    ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / ratingCount) * 10) / 10
    : null;
  const alreadyReviewed = token ? reviews.some((review) => review.user?.id === user?.id) : false;
  const outOfStock = product.stock <= 0;

  const discount =
    product.discountPercent != null
      ? product.discountPercent
      : product.originalPrice != null && Number(product.originalPrice) > Number(product.price)
        ? Math.round(
            ((Number(product.originalPrice) - Number(product.price)) /
              Number(product.originalPrice)) *
              100,
          )
        : null;

  const unitPrice = Number(product.price);

  const purchaseHref = seller?.whatsappNumber
    ? buildWhatsAppHref(
        seller.whatsappNumber,
        buildPurchaseMessage({
          storeName: seller.name,
          productName: product.name,
          quantity,
          unitPrice: unitPrice,
        }),
      )
    : null;

  const handleReviewCreated = (review) => {
    setPostedReviews((previous) => [review, ...previous]);
  };

  return (
    <div className="grid gap-8">
      <Link
        to={`/tienda/${storeSlug ?? ''}`}
        className="text-sm font-medium text-brand-700 hover:text-brand-800"
      >
        ← Volver a {seller?.name ? `la tienda ${seller.name}` : 'la tienda'}
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-ink-50 shadow-sm">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-8xl font-black text-ink-300">{product.name.charAt(0)}</span>
          )}
          {(product.isNew || discount != null) && (
            <div className="absolute left-3 top-3 flex gap-2">
              {product.isNew && (
                <span className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Nuevo
                </span>
              )}
              {discount != null && (
                <span className="rounded-lg bg-accent-500 px-2 py-1 text-xs font-bold text-brand-950">
                  -{discount}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-2">
                {product.category && (
                  <span className="w-fit rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-800">
                    {product.category.name}
                  </span>
                )}
                <h1 className="text-3xl font-bold tracking-tight text-ink-900">{product.name}</h1>
                {product.description && <p className="text-ink-600">{product.description}</p>}
                {seller && (
                  <Link
                    to={`/tienda/${storeSlug}`}
                    className="w-fit text-sm font-medium text-brand-700 hover:text-brand-800"
                  >
                    Vendido por {seller.name} →
                  </Link>
                )}
              </div>
              <FavoriteButton product={product} />
            </div>
          </div>

          <div className="grid gap-1">
            {discount != null && (
              <span className="text-lg font-medium text-ink-400 line-through">
                {formatPrice(product.originalPrice)}
              </span>
            )}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-brand-800">
                {formatPrice(product.price)}
              </span>
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

          {!outOfStock && (
            <div className="flex items-center justify-between rounded-xl border border-ink-200 bg-white p-2 pr-4 shadow-sm sm:max-w-[15rem]">
              <span className="px-2 text-sm font-medium text-ink-600">Cantidad</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((value) => clampQuantity(value - 1, product.stock))}
                  aria-label="Disminuir cantidad"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-lg text-ink-700 transition hover:bg-ink-50 disabled:text-ink-300"
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span className="min-w-6 text-center text-sm font-bold text-ink-900">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((value) => clampQuantity(value + 1, product.stock))}
                  aria-label="Aumentar cantidad"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-lg text-ink-700 transition hover:bg-ink-50 disabled:text-ink-300"
                  disabled={quantity >= product.stock}
                >
                  +
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-3">
            <a
              href={purchaseHref ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={outOfStock || !purchaseHref}
              onClick={(event) => {
                if (outOfStock || !purchaseHref) event.preventDefault();
              }}
              className={`flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition ${
                outOfStock || !purchaseHref
                  ? 'cursor-not-allowed bg-ink-100 text-ink-400'
                  : 'bg-[#25D366] text-white shadow-sm hover:bg-[#1fb95a]'
              }`}
            >
              <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true" fill="currentColor">
                <path d="M16.04 3C9.4 3 4 8.4 4 15.04c0 2.12.56 4.2 1.62 6.03L4 29l8.12-1.6a12.04 12.04 0 0 0 3.92 0L16.04 3Zm0 2a10.04 10.04 0 1 1-5.7 18.5l-.37-.22-4.4.87.9-4.4-.24-.38A10.04 10.04 0 0 1 16.04 5Z" />
                <path d="M11.1 10.1c-.25-.55-.5-.55-.74-.56h-.62c-.22 0-.6.08-.9.4-.3.34-1.18 1.16-1.18 2.85 0 1.68 1.22 3.3 1.4 3.54.16.23 2.4 3.66 5.83 5.13 2.9 1.25 3.5 1 4.12.94.63-.07 2.02-.83 2.3-1.63.29-.8.29-1.5.2-1.64-.08-.14-.3-.22-.63-.4-.32-.16-1.9-.94-2.2-1.04-.3-.1-.5-.16-.72.16-.2.33-.8 1.03-.98 1.24-.18.2-.36.23-.67.06-.32-.16-1.33-.5-2.55-1.58a9.5 9.5 0 0 1-1.75-2.18c-.18-.32-.02-.5.14-.65.14-.14.32-.36.48-.55.15-.18.2-.31.3-.5.1-.2.05-.36-.02-.5-.08-.16-.72-1.72-.98-2.36Z" />
              </svg>
              {outOfStock ? 'Sin stock' : purchaseHref ? 'Comprar ahora' : 'WhatsApp no disponible'}
            </a>

            <button
              type="button"
              disabled={outOfStock}
              onClick={handleAddToCart}
              className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
                outOfStock
                  ? 'cursor-not-allowed bg-ink-100 text-ink-400'
                  : added
                    ? 'bg-emerald-600 text-white'
                    : 'border border-brand-600 text-brand-700 hover:bg-brand-50'
              }`}
            >
              {outOfStock ? 'Sin stock' : added ? 'Agregado al carrito' : 'Agregar al carrito'}
            </button>
          </div>

          <TrustBadges store={seller ?? {}} />
        </div>
      </div>

      <section className="grid gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">Historial de precios</h2>
        {Array.isArray(product.priceHistory) && product.priceHistory.length > 0 ? (
          <div className="grid gap-2 rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
            {product.priceHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 border-b border-ink-100 pb-2 last:border-b-0 last:pb-0"
              >
                <span className="text-sm text-ink-500">{formatDate(entry.changedAt)}</span>
                <span className="font-semibold text-ink-900">{formatPrice(entry.price)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-10 text-center text-ink-500">
            Este producto no ha registrado cambios de precio.
          </div>
        )}
      </section>

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
              state={{ from: productHref(product, storeSlug) }}
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
