import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { createOrder } from '../services/orders.js';
import { formatPrice } from '../utils/format.js';
import { productHref } from '../utils/links.js';

export default function CartPage() {
  const { token, logout } = useAuth();
  const { items, removeItem, setQuantity, clear, total, totalCount } = useCart();
  const navigate = useNavigate();

  const [status, setStatus] = useState({ phase: 'idle', error: '', placed: null });
  const [blockedBy, setBlockedBy] = useState(null);

  const handleCheckout = async () => {
    if (!token) {
      navigate('/login', { state: { from: '/cart' } });
      return;
    }

    setStatus({ phase: 'submitting', error: '', placed: null });
    setBlockedBy(null);
    try {
      const order = await createOrder(
        token,
        items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
      );
      clear();
      setStatus({ phase: 'placed', error: '', placed: order });
    } catch (error) {
      const message = error.message;
      setStatus({ phase: 'error', error: message, placed: null });
      if (error.status === 409) {
        const failed = items.find((item) => message.includes(`"${item.product.name}"`));
        setBlockedBy(failed?.product.name ?? null);
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (status.phase === 'placed') {
    return (
      <div className="mx-auto grid w-full max-w-lg gap-6 py-8 text-center">
        <div className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-8">
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white"
            aria-hidden="true"
          >
            ✓
          </span>
          <h1 className="text-2xl font-bold text-ink-900">Pedido confirmado</h1>
          <p className="text-ink-600">
            Tu pedido <span className="font-semibold text-ink-900">#{status.placed.id}</span> fue
            creado por <span className="font-semibold">{formatPrice(status.placed.total)}</span> con
            estado{' '}
            <span className="font-semibold capitalize text-brand-800">{status.placed.status}</span>.
          </p>
        </div>
        <Link
          to="/"
          className="mx-auto rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Volver al catálogo
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto grid w-full max-w-lg gap-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Tu carrito está vacío</h1>
        <p className="text-ink-500">Sumá productos desde el catálogo y volvé para finalizar.</p>
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
            const blocked = blockedBy === item.product.name;
            return (
              <li
                key={item.product.id}
                className={`grid gap-4 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-[64px_1fr_auto] sm:items-center ${
                  blocked ? 'border-red-300 bg-red-50' : 'border-ink-200'
                }`}
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
                  {blocked && (
                    <p className="text-xs font-medium text-red-600">
                      Sin stock suficiente — ajustá la cantidad o quitalo.
                    </p>
                  )}
                </div>

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
                  <button
                    type="button"
                    onClick={() => removeItem(item.product.id)}
                    className="ml-2 rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
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

          {status.phase === 'error' && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{status.error}</p>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={status.phase === 'submitting'}
            className="rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-brand-950 transition hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-accent-300"
          >
            {status.phase === 'submitting' ? 'Creando pedido…' : 'Finalizar pedido'}
          </button>

          {!token && (
            <p className="text-xs text-ink-500">
              Vas a ser redirigido a <span className="font-medium">/login</span> para completar la
              compra.
            </p>
          )}
          {token && (
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-ink-400 underline-offset-2 transition hover:text-ink-700 hover:underline"
            >
              Salir y usar otra cuenta
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
