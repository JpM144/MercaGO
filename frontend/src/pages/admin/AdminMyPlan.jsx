import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  createPlanChangeRequest,
  fetchPlanTiers,
  getMyStorePlan,
  listMyPlanChangeRequests,
} from '../../services/plans.js';
import { formatDate, formatPrice } from '../../utils/format.js';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';
import Notice from '../../components/Notice.jsx';
import ReceiptLink from '../../components/ReceiptLink.jsx';

export const PLAN_STATUS_LABELS = {
  pending: 'Pendiente de revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

export const PLAN_STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

export function ProductLimitText(limit) {
  if (limit === null || limit === undefined) return 'Ilimitados';
  return `${limit} producto${Number(limit) === 1 ? '' : 's'}`;
}

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const RECEIPT_ACCEPT = RECEIPT_TYPES.join(',');
const IMAGE_RECEIPT_TYPES = RECEIPT_TYPES.filter((type) => type.startsWith('image/'));

export function validateReceiptFile(file) {
  if (!file) return 'Tenés que adjuntar el comprobante de la transferencia.';
  if (!RECEIPT_TYPES.includes(file.type)) {
    return 'El comprobante debe ser una imagen (JPG, PNG, WebP) o un PDF.';
  }
  if (file.size > RECEIPT_MAX_BYTES) return 'El comprobante no puede superar los 5 MB.';
  return null;
}

function ReceiptUploadModal({ tier, onCancel, onConfirm }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!file || !IMAGE_RECEIPT_TYPES.includes(file.type)) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleChange = (event) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setError(selected ? validateReceiptFile(selected) : '');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validateReceiptFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(file);
    } catch (submitError) {
      setError(submitError.message);
      setSubmitting(false);
    }
  };

  const isPreviewable = Boolean(file && IMAGE_RECEIPT_TYPES.includes(file.type));

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink-950/50 p-4">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid max-h-[90vh] max-w-md gap-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="grid gap-1">
          <h2 className="text-lg font-bold text-ink-900">Solicitar plan {tier.name}</h2>
          <p className="text-sm text-ink-500">
            Adjuntá el comprobante de la transferencia para que el super admin pueda revisarlo.
          </p>
        </div>

        <label className="grid gap-1 text-sm font-medium text-ink-700" htmlFor="plan-receipt">
          Comprobante de la transferencia
          <input
            id="plan-receipt"
            type="file"
            accept={RECEIPT_ACCEPT}
            onChange={handleChange}
            className="block w-full cursor-pointer rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
          />
        </label>
        <p className="text-xs text-ink-500">JPG, PNG, WebP o PDF de hasta 5 MB.</p>

        {isPreviewable && (
          <img
            src={previewUrl}
            alt="Vista previa del comprobante"
            className="max-h-56 w-full rounded-lg border border-ink-200 object-contain"
          />
        )}
        {file && !isPreviewable && (
          <p className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-700">
            Archivo listo para enviar: <span className="font-semibold">{file.name}</span>
          </p>
        )}

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
            disabled={submitting || !file}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PlanCard({ tier, currentTierId, pendingRequest, busyTierId, onRequest }) {
  const isCurrent = tier.id === currentTierId;
  const disabled = isCurrent || Boolean(pendingRequest) || busyTierId === tier.id;

  let buttonLabel = 'Solicitar cambio';
  if (isCurrent) buttonLabel = 'Tu plan actual';
  else if (pendingRequest) buttonLabel = 'Tenés una solicitud pendiente';

  return (
    <div
      className={`grid gap-3 rounded-xl border p-5 shadow-sm ${
        isCurrent ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-ink-900">{tier.name}</h3>
        {isCurrent && (
          <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">
            Actual
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-ink-900">{formatPrice(tier.price)}</p>
      <p className="text-sm text-ink-600">
        Límite de productos: <span className="font-semibold">{ProductLimitText(tier.productLimit)}</span>
      </p>
      <button
        type="button"
        onClick={() => onRequest(tier)}
        disabled={disabled}
        title={pendingRequest && !isCurrent ? 'Ya tenés una solicitud pendiente de revisión.' : undefined}
        className="mt-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-500"
      >
        {busyTierId === tier.id ? 'Enviando…' : buttonLabel}
      </button>
    </div>
  );
}

export default function AdminMyPlan() {
  const { token } = useAuth();
  const [tiers, setTiers] = useState([]);
  const [plan, setPlan] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyTierId, setBusyTierId] = useState(null);
  const [requestingTier, setRequestingTier] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tiersData, planData, requestsData] = await Promise.all([
        fetchPlanTiers(),
        getMyStorePlan(token),
        listMyPlanChangeRequests(token),
      ]);
      setTiers(tiersData.tiers ?? []);
      setPlan(planData);
      setRequests(requestsData.requests ?? []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingRequest = useMemo(
    () => requests.find((item) => item.status === 'pending') ?? null,
    [requests],
  );

  const currentTierId = plan?.tier?.id ?? null;

  const handleRequest = async (tier, receiptFile) => {
    setBusyTierId(tier.id);
    setError(null);
    setNotice(null);
    try {
      const data = await createPlanChangeRequest(token, tier.id, receiptFile);
      setNotice({
        type: 'success',
        text: data.message ?? `Tu solicitud al plan ${tier.name} quedó pendiente de revisión.`,
      });
      setRequestingTier(null);
      await load();
    } catch (requestError) {
      if (requestError.status === 409) {
        setRequestingTier(null);
        await load();
      }
      throw requestError;
    } finally {
      setBusyTierId(null);
    }
  };

  if (loading) return <Spinner label="Cargando tu plan…" />;
  if (error && tiers.length === 0) return <ErrorBanner message={error} onRetry={load} />;

  const usageText =
    plan?.productLimit === null || plan?.productLimit === undefined
      ? `${plan?.activeProducts ?? 0} productos publicados (sin límite)`
      : `${plan?.activeProducts ?? 0} de ${plan?.productLimit} productos publicados`;

  return (
    <div className="grid gap-5" id="mi-plan">
      <div className="grid gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">Mi plan</h2>
        <p className="text-sm text-ink-500">
          Revisá tu plan actual, pedí un cambio y seguí el estado de tus solicitudes.
        </p>
      </div>

      {notice && <Notice type={notice.type}>{notice.text}</Notice>}
      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-sm text-ink-500">Plan actual</p>
            <p className="text-2xl font-bold text-ink-900">{plan?.tier?.name ?? '—'}</p>
          </div>
          <p className="text-sm font-semibold text-ink-700">{usageText}</p>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          Límite de productos: {ProductLimitText(plan?.productLimit)}
        </p>
        {plan?.productLimitReached && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Alcanzaste el límite de productos de tu plan. Pedí un cambio de plan para poder publicar
            más.
          </p>
        )}
      </div>

      {pendingRequest && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">
            Solicitud a {pendingRequest.requestedTier?.name ?? 'otro plan'}:{' '}
            {PLAN_STATUS_LABELS[pendingRequest.status] ?? pendingRequest.status}
          </p>
          <p className="mt-1">
            La vas a poder ver en el historial. No podés enviar otra solicitud hasta que se
            resuelva.
          </p>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-lg font-semibold text-ink-900">Planes disponibles</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => (
            <PlanCard
              key={tier.id}
              tier={tier}
              currentTierId={currentTierId}
              pendingRequest={pendingRequest}
              busyTierId={busyTierId}
              onRequest={setRequestingTier}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold text-ink-900">Historial de solicitudes</h3>
        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-10 text-center text-sm text-ink-500">
            Todavía no pediste ningún cambio de plan.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Plan solicitado</th>
                  <th className="px-4 py-3 font-semibold">Solicitada</th>
                  <th className="px-4 py-3 font-semibold">Resuelta</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Comprobante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {requests.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-ink-900">
                      {item.requestedTier?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-600">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-3 text-ink-600">{formatDate(item.reviewedAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          PLAN_STATUS_STYLES[item.status] ?? 'bg-ink-100 text-ink-600'
                        }`}
                      >
                        {PLAN_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                      {item.status === 'rejected' && item.rejectedReason && (
                        <p className="mt-1 max-w-72 text-xs italic text-red-600">
                          Motivo: {item.rejectedReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.receiptUrl ? (
                        <ReceiptLink token={token} requestId={item.id} scope="store" />
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {requestingTier && (
        <ReceiptUploadModal
          tier={requestingTier}
          onCancel={() => setRequestingTier(null)}
          onConfirm={(file) => handleRequest(requestingTier, file)}
        />
      )}
    </div>
  );
}
