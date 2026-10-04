import { useEffect, useState } from 'react';
import { fetchAnyPlanReceipt, fetchMyPlanReceipt } from '../services/plans.js';

const RECEIPT_FETCHERS = {
  store: fetchMyPlanReceipt,
  superAdmin: fetchAnyPlanReceipt,
};

const LINK_CLASS =
  'inline-flex items-center gap-1 text-xs font-semibold text-brand-700 underline hover:text-brand-800';

export default function ReceiptLink({
  token,
  requestId,
  scope = 'store',
  label = 'Ver comprobante',
}) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!preview) return undefined;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  useEffect(() => {
    if (!preview) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [preview]);

  const handleOpen = async () => {
    setLoading(true);
    setError('');
    try {
      const blob = await RECEIPT_FETCHERS[scope](token, requestId);
      setPreview({ url: URL.createObjectURL(blob), type: blob.type });
    } catch (openError) {
      setError(openError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className={`${LINK_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {loading ? 'Abriendo…' : label}
        <span className="text-[10px] text-ink-400" aria-hidden="true">
          ↗
        </span>
      </button>
      {error && <p className="mt-1 max-w-56 text-xs text-red-600">{error}</p>}
      {preview && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-ink-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Comprobante de la transferencia"
        >
          <div className="grid max-h-[90vh] w-full max-w-3xl gap-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-ink-900">Comprobante de la transferencia</h3>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50"
              >
                Cerrar
              </button>
            </div>
            {preview.type === 'application/pdf' ? (
              <iframe
                src={preview.url}
                title="Comprobante de la transferencia"
                className="h-[70vh] w-full rounded-lg border border-ink-200"
              />
            ) : (
              <img
                src={preview.url}
                alt="Comprobante de la transferencia"
                className="max-h-[70vh] w-full rounded-lg border border-ink-200 object-contain"
              />
            )}
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="justify-self-start text-xs font-semibold text-brand-700 underline hover:text-brand-800"
            >
              Abrir en otra pestaña
            </a>
          </div>
        </div>
      )}
    </>
  );
}
