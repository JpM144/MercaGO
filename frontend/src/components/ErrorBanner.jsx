export default function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl font-bold text-red-600"
        aria-hidden="true"
      >
        !
      </div>
      <div>
        <h2 className="text-lg font-semibold text-red-800">No pudimos cargar los datos</h2>
        <p className="mt-1 text-sm text-red-600">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
