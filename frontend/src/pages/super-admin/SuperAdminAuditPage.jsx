import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { listAuditLogs } from '../../services/admin.js';
import { formatDate } from '../../utils/format.js';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';

const ACTIONS = [
  { value: 'approve_application', label: 'Aprobó una solicitud' },
  { value: 'reject_application', label: 'Rechazó una solicitud' },
  { value: 'pause_store', label: 'Pausó una tienda' },
  { value: 'reactivate_store', label: 'Reactivó una tienda' },
  { value: 'cancel_store', label: 'Canceló una tienda' },
];

const ACTION_STYLES = {
  approve_application: 'bg-emerald-100 text-emerald-800',
  reject_application: 'bg-red-100 text-red-700',
  pause_store: 'bg-amber-100 text-amber-800',
  reactivate_store: 'bg-teal-100 text-teal-800',
  cancel_store: 'bg-red-100 text-red-700',
};

function dayStart(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function dayEnd(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function actorLabel(log) {
  if (log.actor) {
    return log.actor.name ? `${log.actor.name} <${log.actor.email}>` : log.actor.email;
  }
  if (log.details?.actorEmail) {
    return log.details.actorName ? `${log.details.actorName} <${log.details.actorEmail}>` : log.details.actorEmail;
  }
  return '—';
}

function targetLabel(log) {
  const type = log.targetType === 'store' ? 'Tienda' : 'Solicitud';
  const name = log.details?.targetName ?? `${type} #${log.targetId}`;
  const slug = log.details?.targetSlug;
  return { type, name, slug };
}

function detailText(log) {
  const details = log.details ?? {};
  if (details.reason) return `Motivo: ${details.reason}`;
  if (log.action === 'approve_application' && details.resultingStoreId) {
    return `Tienda creada (${details.resultingStoreId})`;
  }
  if (log.targetType === 'store' && details.planStatus) {
    return `Plan → ${details.planStatus}`;
  }
  return '—';
}

export default function SuperAdminAuditPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = { action: action || undefined };
      if (from) filters.from = dayStart(from).toISOString();
      if (to) filters.to = dayEnd(to).toISOString();
      const data = await listAuditLogs(token, filters);
      setLogs(data.logs ?? []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [token, action, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const clearFilters = () => {
    setAction('');
    setFrom('');
    setTo('');
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">Auditoría</h2>
        <p className="text-sm text-ink-500">
          Historial de aprobaciones/rechazos de solicitudes y cambios de plan (pausar, reactivar,
          cancelar) ejecutados por administradores.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-ink-200 bg-white p-4 shadow-sm sm:grid-cols-[220px_1fr_1fr_auto]">
        <label className="grid gap-1 text-sm font-medium text-ink-700">
          Acción
          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="rounded-lg border border-ink-200 px-3 py-2 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          >
            <option value="">Todas</option>
            {ACTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-ink-700">
          Desde
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded-lg border border-ink-200 px-3 py-2 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-ink-700">
          Hasta
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="rounded-lg border border-ink-200 px-3 py-2 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-50"
          >
            Limpiar
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <Spinner label="Cargando auditoría…" />
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-14 text-center text-ink-500">
          No hay acciones registradas para esos filtros.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Fecha y hora</th>
                <th className="px-4 py-3 font-semibold">Quién</th>
                <th className="px-4 py-3 font-semibold">Acción</th>
                <th className="px-4 py-3 font-semibold">Sobre qué</th>
                <th className="px-4 py-3 font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {logs.map((log) => {
                const target = targetLabel(log);
                return (
                  <tr key={log.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-ink-600">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900">{actorLabel(log)}</p>
                      {log.actor && <p className="text-xs text-ink-400">#{log.actor.id}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${ACTION_STYLES[log.action] ?? 'bg-ink-100 text-ink-600'}`}
                      >
                        {log.actionLabel ?? log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900">{target.name}</p>
                      <p className="text-xs text-ink-400">
                        {target.type}
                        {target.slug ? ` · ${target.slug}` : ` #${log.targetId}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{detailText(log)}</td>
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