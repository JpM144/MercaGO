export default function Paginator({ page, totalPages, total, onPage, label }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:text-ink-300"
      >
        Anterior
      </button>
      <p className="text-sm text-ink-500">
        {label ?? `Página ${page} de ${totalPages} · ${total} productos`}
      </p>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:text-ink-300"
      >
        Siguiente
      </button>
    </div>
  );
}
