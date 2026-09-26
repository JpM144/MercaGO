import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAllOrders } from '../../services/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatDate, formatPrice } from '../../utils/format.js';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import { STATUS_BADGES } from './status.js';

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AdminOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [state, setState] = useState({ loading: true, error: null });

  const load = useCallback(async () => {
    setState({ loading: true, error: null });
    try {
      const data = await listAllOrders(token, status || undefined);
      setOrders(data.orders ?? []);
      setState({ loading: false, error: null });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }, [token, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink-900">Pedidos</h2>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filtrar pedidos por estado"
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {state.loading && <Spinner label="Cargando pedidos…" />}

      {!state.loading && state.error && <ErrorBanner message={state.error} onRetry={load} />}

      {!state.loading && !state.error && (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-ink-100 text-xs uppercase tracking-wide text-ink-600">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Ítems</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Creado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {orders.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-ink-500">
                    No hay pedidos{status ? ` en estado "${status}"` : ''}.
                  </td>
                </tr>
              )}
              {orders.map((order) => (
                <tr key={order.id} className="transition hover:bg-brand-50/50">
                  <td className="px-4 py-3 font-semibold text-ink-900">#{order.id}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink-900">{order.user?.name}</span>
                    <span className="block text-xs text-ink-400">{order.user?.email}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {Array.isArray(order.items) ? order.items.length : '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink-900">
                    {formatPrice(order.total)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={STATUS_BADGES[order.status]}>{order.status}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-500">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                    >
                      Ver detalle
                    </Link>
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
