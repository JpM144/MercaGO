import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  approvePlanChangeRequest,
  fetchPlanTiers,
  listAllPlanChangeRequests,
  receiptFileUrl,
  rejectPlanChangeRequest,
} from '../../services/plans.js';
import { formatDate, formatPrice } from '../../utils/format.js';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import Notice from '../../components/Notice.jsx';
import { PLAN_STATUS_LABELS, PLAN_STATUS_STYLES, ProductLimitText } from '../admin/AdminMyPlan.jsx';

const FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
];

function RejectModal({ request, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError('Ingresá un motivo del rechazo.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(reason.trim());
    } catch (rejectError) {
      setError(rejectError.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink-950/50 p-4">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid max-w-md gap-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="grid gap-1">
          <h2 className="text-lg font-bold text-ink-900">
            Rechazar cambio de plan de {request.store?.name ?? 'la tienda'}
          </h2>
          <p className="text-sm text-ink-500">
            El dueño de la tienda va a recibir este motivo por email. La tienda mantiene su plan
            actual.
          </p>
        </div>
        <label className="grid gap-1 text-sm font-medium text-ink-700" htmlFor="plan-reject-reason">
          Motivo del rechazo
          <textarea
            id="plan-reject-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej.: El comprobante no coincide con el plan solicitado."
            className="rounded-lg border border-ink-200 px-3 py-2 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </label>
        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !reason.trim()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Rechazando…' : 'Rechazar solicitud'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SuperAdminPlanChangesPage() {
  const { token } = useAuth();
  const [requests, setRequests] = useState([]);
  const [tierNames, setTierNames] = useState({});
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAllPlanChangeRequests(token, filter);
      setRequests(data.requests ?? []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetchPlanTiers()
      .then((data) => {
        if (cancelled) return;
        setTierNames(Object.fromEntries((data.tiers ?? []).map((t) => [t.id, t.name])));
      })
      .catch(() => {
        if (!cancelled) setTierNames({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const result = { all: requests.length };
    requests.forEach((item) => {
      result[item.status] = (result[item.status] ?? 0) + 1;
    });
    return result;
  }, [requests]);

  const handleApprove = async (request) => {
    setBusyId(request.id);
    setError(null);
    setNotice(null);
    try {
      const data = await approvePlanChangeRequest(token, request.id);
      setNotice({ type: 'success', text: data.message ?? 'Solicitud aprobada.' });
      await load();
    } catch (approveError) {
      setError(approveError.message);
      if (approveError.status === 409) {
        await load();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (reason) => {
    const request = rejecting;
    if (!request) return;
    setBusyId(request.id);
    setError(null);
    setNotice(null);
    try {
      const data = await rejectPlanChangeRequest(token, request.id, reason);
      setNotice({ type: 'success', text: data.message ?? 'Solicitud rechazada.' });
      setRejecting(null);
      await load();
    } catch (rejectError) {
      setError(rejectError.message);
      if (rejectError.status === 409) {
        setRejecting(null);
        await load();
      } else {
        throw rejectError;
      }
    } finally {
      setBusyId(null);
    }
  };

  const currentTierName = (request) =>
    tierNames[request.store?.planTierId] ?? (request.store?.planTierId ? `Plan #${request.store.planTierId}` : '—');

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">Cambios de plan</h2>
        <p className="text-sm text-ink-500">
          Revisá el comprobante que adjuntó la tienda. Al aprobar, pasa al plan solicitado y el
          dueño recibe un email; al rechazar, se le informa el motivo y la tienda mantiene su plan.
        </p>
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
            {item.label}
            {filter === item.value ? ` (${counts[item.value] ?? 0})` : ''}
          </button>
        ))}
      </div>

      {notice && <Notice type={notice.type}>{notice.text}</Notice>}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <Spinner label="Cargando solicitudes de cambio de plan…" />
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-14 text-center text-ink-500">
          No hay solicitudes
          {filter === 'all' ? '' : ` ${PLAN_STATUS_LABELS[filter]?.toLowerCase() ?? filter} `} para
          mostrar.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Tienda</th>
                <th className="px-4 py-3 font-semibold">Plan actual</th>
                <th className="px-4 py-3 font-semibold">Plan solicitado</th>
                <th className="px-4 py-3 font-semibold">Solicitada</th>
                <th className="px-4 py-3 font-semibold">Comprobante</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {requests.map((request) => (
                <tr key={request.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink-900">{request.store?.name ?? '—'}</p>
                    <p className="text-xs text-ink-400">/{request.store?.slug ?? '—'}</p>
                    {request.requestedBy?.email && (
                      <p className="text-xs text-ink-400">{request.requestedBy.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-700">{currentTierName(request)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900">{request.requestedTier?.name ?? '—'}</p>
                    <p className="text-xs text-ink-500">
                      {formatPrice(request.price)} ·{' '}
                      {ProductLimitText(request.requestedTier?.productLimit ?? null)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{formatDate(request.createdAt)}</td>
                  <td className="px-4 py-3">
                    {receiptFileUrl(request.receiptUrl) ? (
                      <a
                        href={receiptFileUrl(request.receiptUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 underline hover:text-brand-800"
                      >
                        Ver comprobante
                        <span className="text-[10px] text-ink-400" aria-hidden="true">
                          ↗
                        </span>
                      </a>
                    ) : (
                      <span className="text-xs text-ink-400">Sin comprobante</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        PLAN_STATUS_STYLES[request.status] ?? 'bg-ink-100 text-ink-600'
                      }`}
                    >
                      {PLAN_STATUS_LABELS[request.status] ?? request.status}
                    </span>
                    {request.status === 'rejected' && request.rejectedReason && (
                      <p className="mt-1 max-w-52 text-xs italic text-red-600">
                        Motivo: {request.rejectedReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {request.status === 'pending' ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(request)}
                          disabled={busyId === request.id}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyId === request.id ? '…' : 'Aprobar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(request)}
                          disabled={busyId === request.id}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <span className="block text-right text-xs text-ink-400">
                        {request.reviewedAt ? formatDate(request.reviewedAt) : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejecting && (
        <RejectModal
          request={rejecting}
          onCancel={() => setRejecting(null)}
          onConfirm={handleReject}
        />
      )}
    </div>
  );
}
