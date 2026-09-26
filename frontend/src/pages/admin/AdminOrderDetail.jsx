import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrder, updateOrderStatus } from '../../services/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatDate, formatPrice } from '../../utils/format.js';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import Notice from '../../components/Notice.jsx';
import { ORDER_TRANSITIONS, STATUS_BADGES } from './status.js';

export default function AdminOrderDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [nextStatus, setNextStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const data = await getOrder(token, id);
      setState({ loading: false, data: data.order, error: null });
      setNextStatus('');
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async () => {
    if (!nextStatus) return;
    setSaving(true);
    setNotice(null);
    try {
      const data = await updateOrderStatus(token, id, nextStatus);
      setState((previous) => ({ ...previous, data: data.order }));
      setNextStatus('');
      setNotice({ type: 'success', text: `Pedido #${id} cambiado a ${nextStatus}.` });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (state.loading) {
    return <Spinner label="Cargando pedido…" />;
  }

  if (state.error) {
    return (
      <div className="grid gap-4">
        <ErrorBanner message={state.error} onRetry={load} />
        <Link
          to="/admin/orders"
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          Volver a pedidos
        </Link>
      </div>
    );
  }

  const order = state.data;
  const allowed = ORDER_TRANSITIONS[order.status] ?? [];

  return (
    <div className="grid gap-5">
      <Link to="/admin/orders" className="text-sm font-medium text-brand-700 hover:text-brand-800">
        ← Volver a pedidos
      </Link>

      <div className="grid gap-5 rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-2xl font-bold text-ink-900">Pedido #{order.id}</h2>
            <p className="text-sm text-ink-500">
              {order.user?.name} · {order.user?.email} · creado {formatDate(order.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={STATUS_BADGES[order.status]}>{order.status}</span>
            <span className="text-xl font-bold text-brand-800">{formatPrice(order.total)}</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-ink-100">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-ink-100 text-xs uppercase tracking-wide text-ink-600">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">Precio unitario</th>
                <th className="px-4 py-3">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {(order.items ?? []).map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink-900">
                      {item.product?.name ?? `#${item.productId}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{item.quantity}</td>
                  <td className="px-4 py-3 text-ink-600">{formatPrice(item.unitPrice)}</td>
                  <td className="px-4 py-3 font-semibold text-ink-900">
                    {formatPrice(item.unitPrice * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 border-t border-ink-100 pt-4">
          <h3 className="text-sm font-semibold text-ink-900">Cambiar estado</h3>
          {allowed.length === 0 ? (
            <p className="text-sm text-ink-500">
              Este pedido está en estado terminal ({order.status}) y no admite cambios.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={nextStatus}
                onChange={(event) => setNextStatus(event.target.value)}
                aria-label="Nuevo estado"
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              >
                <option value="">Seleccioná un estado…</option>
                {allowed.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleStatusChange}
                disabled={!nextStatus || saving}
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
              >
                {saving ? 'Actualizando…' : 'Cambiar estado'}
              </button>
              <span className="text-xs text-ink-400">Permitido: {allowed.join(', ')}</span>
            </div>
          )}
          {notice && <Notice type={notice.type}>{notice.text}</Notice>}
        </div>
      </div>
    </div>
  );
}
