import { useStore } from '../../context/StoreContext.jsx';

export default function StoreSectionPlaceholder({ title, description }) {
  const store = useStore();

  return (
    <div className="grid gap-3 rounded-xl border border-dashed border-ink-300 bg-white px-6 py-16 text-center">
      <h2 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h2>
      <p className="text-ink-500">
        {description ?? `Esta sección de ${store.name} está por llegar.`}
      </p>
    </div>
  );
}
