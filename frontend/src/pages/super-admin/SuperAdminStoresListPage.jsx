import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { changeStorePlanStatus, listPlanStores } from '../../services/admin.js';
import { formatDay } from '../../utils/format.js';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';

const PLAN_LABELS = {
  active: 'Activo',
  nearExpiry: 'Por vencer',
  paused: 'Pausada',
  expired: 'Vencida',
  cancelled: 'Cancelada',
};

const PLAN_STYLES = {
  active: 'bg-emerald-100 text-emerald-800',
  nearExpiry: 'bg-amber-100 text-amber-800',
  paused: 'bg-violet-100 text-violet-700',
  expired: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
};

const FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'nearExpiry', label: 'Por vencer' },
  { value: 'paused', label: 'Pausadas' },
  { value: 'expired', label: 'Vencidas' },
  { value: 'cancelled', label: 'Canceladas' },
];

function displayKey(store) {
  return store.planStatus === 'active' && store.expiringSoon ? 'nearExpiry' : store.planStatus;
}

function actionButtons(store, busy, onAction) {
  const buttons = [];
  if (store.planStatus === 'active') {
    buttons.push(
      { action: 'pause', label: 'Pausar', className: 'border border-amber-300 text-amber-800 hover:bg-amber-50' },
      { action: 'cancel', label: 'Cancelar', className: 'border border-red-200 text-red-600 hover:bg-red-50' },
    );
  }
  if (store.planStatus === 'paused') {
    buttons.push(
      { action: 'reactivate', label: 'Reactivar', className: 'bg-emerald-600 text-white hover:bg-emerald-700' },
      { action: 'cancel', label: 'Cancelar', className: 'border border-red-200 text-red-600 hover:bg-red-50' },
    );
  }
  if (store.planStatus === 'cancelled') {
    buttons.push({
      action: 'reactivate',
      label: 'Reactivar',
      className: 'bg-emerald-600 text-white hover:bg-emerald-700',
    });
  }
  if (store.planStatus === 'expired') {
    buttons.push({
      action: 'cancel',
      label: 'Cancelar',
      className: 'border border-red-200 text-red-600 hover:bg-red-50',
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {buttons.map((button) => (
        <button
          key={button.action}
          type="button"
          onClick={() => onAction(store, button.action)}
          disabled={busy === store.id}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${button.className}`}
        >
          {busy === store.id ? '…' : button.label}
        </button>
      ))}
    </div>
  );
}

export default function SuperAdminStoresListPage() {
  const { token } = useAuth();
  const [stores, setStores] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPlanStores(token);
      setStores(data.stores ?? []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const result = {
      all: stores.length,
      active: 0,
      nearExpiry: 0,
      paused: 0,
      expired: 0,
      cancelled: 0,
    };
    stores.forEach((store) => {
      const key = displayKey(store);
      result[key] = (result[key] ?? 0) + 1;
    });
    return result;
  }, [stores]);

  const visibleStores = useMemo(
    () => (filter === 'all' ? stores : stores.filter((store) => displayKey(store) === filter)),
    [stores, filter],
  );

  const handleAction = async (store, action) => {
    if (action === 'cancel' && !window.confirm(`¿Cancelar la tienda "${store.name}"?`)) {
      return;
    }
    setBusyId(store.id);
    setError(null);
    try {
      const data = await changeStorePlanStatus(token, store.id, action);
      setStores((prev) =>
        prev.map((item) => (item.id === store.id ? { ...item, ...data.store } : item)),
      );
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">Tiendas y planes</h2>
        <p className="max-w-2xl text-sm text-ink-500">
          Estado del plan de cada tienda. Pausá una tienda para frenar su operación, cancelala para
          darla de baja o reactivala cuando quieras que vuelva a vender. El vencimiento se calcula
          por fecha: una tienda vencida solo vuelve a operar con una renovación.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Activa
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Por vencer
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Pausada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Vencida / Cancelada
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              filter === item.value
                ? 'bg-brand-600 text-white'
                : 'border border-ink-200 bg-white text-ink-600 hover:bg-brand-50'
            }`}
          >
            {item.label} ({counts[item.value] ?? 0})
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <Spinner label="Cargando tiendas…" />
      ) : visibleStores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-14 text-center text-ink-500">
          No hay tiendas con ese estado para mostrar.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Tienda</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Vencimiento</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visibleStores.map((store) => {
                const key = displayKey(store);
                return (
                  <tr key={store.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-900">{store.name}</p>
                      <p className="text-xs text-ink-400">{store.slug}</p>
                      {store.owner && (
                        <p className="mt-0.5 text-xs text-ink-400">
                          {store.owner.name} · {store.owner.email}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${PLAN_STYLES[key] ?? 'bg-ink-100 text-ink-600'}`}
                      >
                        {PLAN_LABELS[key] ?? store.planStatus}
                      </span>
                      {store.planStatus === 'expired' && (
                        <p className="mt-1 text-xs italic text-red-600">
                          Vence por fecha: requiere renovación.
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {store.planExpiresAt ? formatDay(store.planExpiresAt) : '—'}
                    </td>
                    <td className="px-4 py-3">{actionButtons(store, busyId, handleAction)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}