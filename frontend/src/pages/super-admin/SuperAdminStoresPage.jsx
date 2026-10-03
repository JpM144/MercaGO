import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  listStoreApplications,
  approveStoreApplication,
  rejectStoreApplication,
} from '../../services/admin.js';
import { formatDate } from '../../utils/format.js';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';

const FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
];

const STATUS_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

function RejectModal({ application, onCancel, onConfirm }) {
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
            Rechazar solicitud &quot;{application.storeName}&quot;
          </h2>
          <p className="text-sm text-ink-500">
            {application.applicantName} recibirá este motivo por email. No se creará una cuenta ni
            una tienda.
          </p>
        </div>
        <label className="grid gap-1 text-sm font-medium text-ink-700" htmlFor="reject-reason">
          Motivo del rechazo
          <textarea
            id="reject-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej.: Falta la documentación de la tienda."
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

export default function SuperAdminStoresPage() {
  const { token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listStoreApplications(token);
      setApplications(data.applications ?? []);
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
    const result = { all: applications.length, pending: 0, approved: 0, rejected: 0 };
    applications.forEach((application) => {
      result[application.status] = (result[application.status] ?? 0) + 1;
    });
    return result;
  }, [applications]);

  const visibleApplications = useMemo(
    () =>
      filter === 'all'
        ? applications
        : applications.filter((application) => application.status === filter),
    [applications, filter],
  );

  const replaceApplication = (updated) => {
    setApplications((prev) =>
      prev.map((application) => (application.id === updated.id ? updated : application)),
    );
  };

  const handleApprove = async (application) => {
    setBusyId(application.id);
    setError(null);
    try {
      const data = await approveStoreApplication(token, application.id);
      replaceApplication(data.application);
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
    const application = rejecting;
    if (!application) return;
    setBusyId(application.id);
    setError(null);
    try {
      const data = await rejectStoreApplication(token, application.id, reason);
      replaceApplication(data.application);
      setRejecting(null);
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

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-ink-900">Solicitudes de tienda</h2>
          <p className="text-sm text-ink-500">
            Al aprobar una solicitud se crean la cuenta del dueño y la tienda. Al rechazarla, solo
            se notifica y queda descartada.
          </p>
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
        <Spinner label="Cargando solicitudes…" />
      ) : visibleApplications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-14 text-center text-ink-500">
          No hay solicitudes {filter === 'all' ? '' : `${STATUS_LABELS[filter].toLowerCase()}s `}
          para mostrar.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Tienda</th>
                <th className="px-4 py-3 font-semibold">Solicitante</th>
                <th className="px-4 py-3 font-semibold">Solicitada</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visibleApplications.map((application) => (
                <tr key={application.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink-900">{application.storeName}</p>
                    <p className="text-xs text-ink-400">{application.slug}</p>
                    {application.rejectedReason && (
                      <p className="mt-1 max-w-52 text-xs italic text-red-600">
                        Motivo: {application.rejectedReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-ink-800">{application.applicantName}</p>
                    <p className="text-xs text-ink-400">{application.applicantEmail}</p>
                    <p className="text-xs text-ink-400">{application.whatsappNumber}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{formatDate(application.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[application.status] ?? 'bg-ink-100 text-ink-600'}`}
                    >
                      {STATUS_LABELS[application.status] ?? application.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {application.status === 'pending' ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(application)}
                          disabled={busyId === application.id}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyId === application.id ? '…' : 'Aprobar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(application)}
                          disabled={busyId === application.id}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <span className="block text-right text-xs text-ink-300">
                        {application.status === 'approved'
                          ? `Operando en /tienda/${application.resultingStore?.slug ?? application.slug}`
                          : 'Descartada'}
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
          application={rejecting}
          onCancel={() => setRejecting(null)}
          onConfirm={handleReject}
        />
      )}
    </div>
  );
}
