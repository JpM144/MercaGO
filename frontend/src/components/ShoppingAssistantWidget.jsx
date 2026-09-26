import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { sendShoppingAssistantMessage } from '../services/shoppingAssistant.js';
import { formatPrice } from '../utils/format.js';
import { productHref } from '../utils/links.js';

const GREETING =
  '¿Necesitas ayuda con tu compra? Te ayudo a encontrar tu producto ideal entre todas las tiendas 🤖';

function ProductSuggestion({ product }) {
  return (
    <Link
      to={productHref(product)}
      className="flex items-center gap-3 rounded-lg border border-ink-200 bg-white p-2 transition hover:border-brand-400 hover:bg-brand-50"
    >
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-12 w-12 shrink-0 rounded-lg object-cover"
          loading="lazy"
        />
      ) : (
        <span className="grid h-12 w-12 shrink-0 place-items-center bg-ink-100 font-bold text-ink-400">
          {product.name.charAt(0)}
        </span>
      )}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate text-sm font-medium text-ink-900">{product.name}</span>
        <span className="truncate text-xs text-ink-500">{product.store?.name ?? 'TechStore'}</span>
        <span className="text-sm font-bold text-brand-800">{formatPrice(product.price)}</span>
      </span>
      <span className="shrink-0 text-ink-300" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

export default function ShoppingAssistantWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    { id: 'greeting', role: 'assistant', content: GREETING, products: [] },
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const hiddenOn =
    location.pathname.startsWith('/admin') || location.pathname.startsWith('/super-admin');

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, open]);

  const runConversation = useCallback(async (conversation) => {
    setError(null);
    setSending(true);
    try {
      const data = await sendShoppingAssistantMessage(conversation);
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply,
          products: data.products ?? [],
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setMessages((previous) => [...previous, { id: crypto.randomUUID(), role: 'user', content }]);
    setDraft('');
    runConversation([
      ...messages.map((message) => ({ role: message.role, content: message.content })),
      { role: 'user', content },
    ]);
  };

  if (hiddenOn) return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-50 grid max-h-[70vh] w-[min(360px,calc(100vw-2.5rem))] grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-ink-100 bg-brand-950 px-4 py-3">
            <p className="text-sm font-semibold text-white">
              Asistente TechStore <span aria-hidden="true">🤖</span>
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar chat"
              className="rounded-lg px-2 py-1 text-lg leading-none text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>

          <div
            ref={scrollRef}
            className="grid content-start gap-3 overflow-y-auto bg-ink-50 p-3"
            aria-live="polite"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'rounded-br-sm bg-brand-600 text-white'
                      : 'rounded-bl-sm bg-white text-ink-900 shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {Array.isArray(message.products) && message.products.length > 0 && (
                    <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto pr-1">
                      {message.products.map((product) => (
                        <ProductSuggestion key={product.id} product={product} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-ink-500 shadow-sm">
                  <span className="inline-flex items-end gap-1 align-middle">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:300ms]" />
                  </span>
                  <span className="ml-2">buscando…</span>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 border-t border-ink-100 bg-white p-3"
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              placeholder="Ej: ¿tenés fundas para iPhone?"
              className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              aria-label="Mensaje al asistente de compras"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Enviar mensaje"
              className="shrink-0 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
            >
              {sending ? '…' : 'Enviar'}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente de compras'}
        className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-2xl shadow-lg transition hover:scale-105 hover:bg-brand-700"
      >
        <span aria-hidden="true">{open ? '×' : '🤖'}</span>
      </button>
    </>
  );
}
