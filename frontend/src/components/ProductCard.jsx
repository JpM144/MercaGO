import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/format.js';
import { productHref } from '../utils/links.js';
import { useStore } from '../context/StoreContext.jsx';
import FavoriteButton from './FavoriteButton.jsx';

export default function ProductCard({ product }) {
  const storeContext = useStore();
  const detailTo = productHref(product, storeContext?.slug);
  const outOfStock = product.stock <= 0;
  const discount =
    product.originalPrice != null && Number(product.originalPrice) > Number(product.price)
      ? Math.round(
          ((Number(product.originalPrice) - Number(product.price)) /
            Number(product.originalPrice)) *
            100,
        )
      : null;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link
        to={detailTo}
        className="relative flex aspect-square items-center justify-center bg-ink-50"
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-5xl font-black text-ink-300">{product.name.charAt(0)}</span>
        )}
        {discount != null && (
          <span className="absolute left-2 top-2 rounded-lg bg-accent-500 px-2 py-1 text-xs font-bold text-brand-950">
            -{discount}%
          </span>
        )}
        {outOfStock && (
          <span className="absolute bottom-2 left-2 rounded-lg bg-ink-950/85 px-2 py-1 text-xs font-semibold text-white">
            Sin stock
          </span>
        )}
      </Link>
      <FavoriteButton product={product} className="absolute right-2 top-2" />
      <Link to={detailTo} className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-medium text-ink-900 group-hover:text-brand-700">{product.name}</h3>
        {product.store?.name && (
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            {product.store.name}
          </span>
        )}
        <div className="mt-auto pt-2">
          {discount != null && (
            <p className="text-xs font-medium text-ink-400 line-through">
              {formatPrice(product.originalPrice)}
            </p>
          )}
          <p className="text-lg font-bold text-brand-800">{formatPrice(product.price)}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <span className={outOfStock ? 'text-red-500' : 'text-emerald-600'}>
            {outOfStock ? 'Agotado' : `${product.stock} disponibles`}
          </span>
        </div>
      </Link>
    </div>
  );
}
