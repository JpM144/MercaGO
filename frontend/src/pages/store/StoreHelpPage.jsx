import { useStore } from '../../context/StoreContext.jsx';
import { buildWhatsAppLink } from '../../utils/whatsapp.js';

function HelpSection({ icon, title, text }) {
  return (
    <div className="grid gap-2 rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-xl">
          {icon}
        </span>
        <h3 className="font-bold text-ink-900">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-ink-600">{text}</p>
    </div>
  );
}

export default function StoreHelpPage() {
  const store = useStore();

  const sections = [
    { icon: '🕐', title: 'Horarios de atención', text: store.businessHours },
    { icon: '🚚', title: 'Envíos', text: store.shippingInfo },
    { icon: '🧾', title: 'Garantía', text: store.warrantyInfo },
    { icon: '💳', title: 'Medios de pago', text: store.paymentMethods },
  ].filter((section) => Boolean(section.text));

  const whatsappHref = buildWhatsAppLink(store.whatsappNumber, store.name);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">Ayuda</h2>
        <p className="text-sm text-ink-500">
          Toda la información que necesitás saber sobre {store.name}.
        </p>
      </div>

      {sections.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <HelpSection key={section.title} {...section} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center text-ink-500">
          Esta tienda todavía no publicó información de ayuda.
        </div>
      )}

      {whatsappHref && (
        <div className="grid gap-3 rounded-xl border border-ink-200 bg-white p-6 text-center shadow-sm">
          <h3 className="font-bold text-ink-900">¿Tenés otra consulta?</h3>
          <p className="text-sm text-ink-500">
            Escribinos directamente y te respondemos a la brevedad.
          </p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-auto inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1fb95a]"
          >
            <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true" fill="currentColor">
              <path d="M16.04 3C9.4 3 4 8.4 4 15.04c0 2.12.56 4.2 1.62 6.03L4 29l8.12-1.6a12.04 12.04 0 0 0 3.92 0L16.04 3Zm0 2a10.04 10.04 0 1 1-5.7 18.5l-.37-.22-4.4.87.9-4.4-.24-.38A10.04 10.04 0 0 1 16.04 5Z" />
              <path d="M11.1 10.1c-.25-.55-.5-.55-.74-.56h-.62c-.22 0-.6.08-.9.4-.3.34-1.18 1.16-1.18 2.85 0 1.68 1.22 3.3 1.4 3.54.16.23 2.4 3.66 5.83 5.13 2.9 1.25 3.5 1 4.12.94.63-.07 2.02-.83 2.3-1.63.29-.8.29-1.5.2-1.64-.08-.14-.3-.22-.63-.4-.32-.16-1.9-.94-2.2-1.04-.3-.1-.5-.16-.72.16-.2.33-.8 1.03-.98 1.24-.18.2-.36.23-.67.06-.32-.16-1.33-.5-2.55-1.58a9.5 9.5 0 0 1-1.75-2.18c-.18-.32-.02-.5.14-.65.14-.14.32-.36.48-.55.15-.18.2-.31.3-.5.1-.2.05-.36-.02-.5-.08-.16-.72-1.72-.98-2.36Z" />
            </svg>
            Escríbenos por WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
