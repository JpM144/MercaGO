export default function Spinner({ label = 'Cargando…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-ink-500">
      <span
        className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"
        aria-hidden="true"
      />
      <p className="text-sm">{label}</p>
    </div>
  );
}
