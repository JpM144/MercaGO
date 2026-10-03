import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { formatPrice } from '../utils/format.js';
import { buildPurchaseMessage, buildWhatsAppHref } from '../utils/whatsapp.js';
import { productHref } from '../utils/links.js';

export default function CartPage() {
  const { logout } = useAuth();
  const { items, removeItem, setQuantity, total, totalCount } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto grid w-full max-w-lg gap-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Tu carrito está vacío</h1>
        <p className="text-ink-500">
          Suma productos desde el catálogo y vuelve para comprarlos por WhatsApp.
        </p>
        <Link
          to="/"
          className="mx-auto rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Ir al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">Carrito</h1>
        <p className="text-ink-500">
          {totalCount} ítem{totalCount === 1 ? '' : 's'} en tu carrito.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <ul className="grid gap-4">
          {items.map((item) => {
            const sellerNumber = item.product.store?.whatsappNumber;
            const purchaseHref = sellerNumber
              ? buildWhatsAppHref(
                  sellerNumber,
                  buildPurchaseMessage({
                    storeName: item.product.store?.name ?? 'la tienda',
                    productName: item.product.name,
                    quantity: item.quantity,
                    unitPrice: Number(item.product.price),
                  }),
                )
              : null;
            return (
              <li
                key={item.product.id}
                className="grid gap-4 rounded-xl border border-ink-200 bg-white p-4 shadow-sm sm:grid-cols-[64px_1fr_auto] sm:items-center"
              >
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-ink-50">
                  {item.product.imageUrl ? (
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-black text-ink-300">
                      {item.product.name.charAt(0)}
                    </span>
                  )}
                </div>

                <div className="grid gap-1">
                  <Link
                    to={productHref(item.product)}
                    className="font-medium text-ink-900 hover:text-brand-700"
                  >
                    {item.product.name}
                  </Link>
                  <p className="text-sm text-ink-500">
                    {formatPrice(item.product.price)} c/u ·{' '}
                    <span className="font-semibold text-ink-800">
                      Subtotal {formatPrice(item.product.price * item.quantity)}
                    </span>
                  </p>
                </div>

                <div className="grid justify-items-center gap-3 sm:justify-items-end">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity(item.product.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 font-bold text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:text-ink-300"
                      aria-label="Reducir cantidad"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-ink-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(item.product.id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stock}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 font-bold text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:text-ink-300"
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>

                  <a
                    href={purchaseHref ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!purchaseHref}
                    aria-label={`Comprar ${item.product.name} x${item.quantity} por WhatsApp`}
                    onClick={(event) => {
                      if (!purchaseHref) event.preventDefault();
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      purchaseHref
                        ? 'bg-[#25D366] text-white shadow-sm hover:bg-[#1fb95a]'
                        : 'cursor-not-allowed bg-ink-100 text-ink-400'
                    }`}
                  >
                    <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden="true" fill="currentColor">
                      <path d="M16.04 3C9.4 3 4 8.4 4 15.04c0 2.12.56 4.2 1.62 6.03L4 29l8.12-1.6a12.04 12.04 0 0 0 3.92 0L16.04 3Zm0 2a10.04 10.04 0 1 1-5.7 18.5l-.37-.22-4.4.87.9-4.4-.24-.38A10.04 10.04 0 0 1 16.04 5Z" />
                      <path d="M11.1 10.1c-.25-.55-.5-.55-.74-.56h-.62c-.22 0-.6.08-.9.4-.3.34-1.18 1.16-1.18 2.85 0 1.68 1.22 3.3 1.4 3.54.16.23 2.4 3.66 5.83 5.13 2.9 1.25 3.5 1 4.12.94.63-.07 2.02-.83 2.3-1.63.29-.8.29-1.5.2-1.64-.08-.14-.3-.22-.63-.4-.32-.16-1.9-.94-2.2-1.04-.3-.1-.5-.16-.72.16-.2.33-.8 1.03-.98 1.24-.18.2-.36.23-.67.06-.32-.16-1.33-.5-2.55-1.58a9.5 9.5 0 0 1-1.75-2.18c-.18-.32-.02-.5.14-.65.14-.14.32-.36.48-.55.15-.18.2-.31.3-.5.1-.2.05-.36-.02-.5-.08-.16-.72-1.72-.98-2.36Z" />
                    </svg>
                    {purchaseHref ? 'Comprar ahora' : 'WhatsApp no disponible'}
                  </a>

                  <button
                    type="button"
                    onClick={() => removeItem(item.product.id)}
                    className="rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                  >
                    Quitar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="grid gap-4 rounded-xl border border-ink-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold text-ink-900">Resumen</h2>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-500">Total</span>
            <span className="text-2xl font-bold text-brand-800">{formatPrice(total)}</span>
          </div>

          <p className="text-xs text-ink-500">
            Compra cada ítem por WhatsApp: toca «Comprar ahora» en el producto que quieres llevarte.
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-ink-400 underline-offset-2 transition hover:text-ink-700 hover:underline"
          >
            Salir y usar otra cuenta
          </button>
        </aside>
      </div>
    </div>
  );
}
