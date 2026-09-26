import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/format.js';

export default function ProductCard({ product }) {
  const outOfStock = product.stock <= 0;

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative flex aspect-square items-center justify-center bg-ink-50">
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
        {outOfStock && (
          <span className="absolute right-2 top-2 rounded-lg bg-ink-950/85 px-2 py-1 text-xs font-semibold text-white">
            Sin stock
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-medium text-ink-900 group-hover:text-brand-700">{product.name}</h3>
        <p className="mt-auto pt-2 text-lg font-bold text-brand-800">
          {formatPrice(product.price)}
        </p>
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <span className={outOfStock ? 'text-red-500' : 'text-emerald-600'}>
            {outOfStock ? 'Agotado' : `${product.stock} disponibles`}
          </span>
        </div>
      </div>
    </Link>
  );
}
