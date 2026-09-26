import { useCallback, useEffect, useRef, useState } from 'react';
import { sendSalesAssistantMessage } from '../../services/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatPrice } from '../../utils/format.js';
import { STATUS_BADGES } from './status.js';

const inputClass =
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200';

function SaleCard({ order }) {
  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-emerald-800">
            Venta registrada · Pedido #{order.id}
          </p>
          <p className="text-xs text-emerald-700">
            Cliente: {order.customerName ? `${order.customerName} · ` : ''}
            {order.customerContact ?? 'sin datos de contacto'}
          </p>
        </div>
        <div className="grid gap-1 text-right">
          <span className={STATUS_BADGES[order.status]}>{order.status}</span>
          <p className="text-lg font-bold text-emerald-800">{formatPrice(order.total)}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-emerald-200 bg-white">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="bg-emerald-50 text-emerald-700">
            <tr>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Cant.</th>
              <th className="px-3 py-2">Unitario</th>
              <th className="px-3 py-2">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-100">
            {(order.items ?? []).map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2 font-medium text-ink-900">
                  {item.product?.name ?? `#${item.productId}`}
                </td>
                <td className="px-3 py-2 text-ink-600">{item.quantity}</td>
                <td className="px-3 py-2 text-ink-600">{formatPrice(item.unitPrice)}</td>
                <td className="px-3 py-2 font-semibold text-ink-900">
                  {formatPrice(item.unitPrice * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminSalesAssistant() {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const lastConversation = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const runConversation = useCallback(
    async (conversation) => {
      lastConversation.current = conversation;
      setError(null);
      setSending(true);
      try {
        const data = await sendSalesAssistantMessage(token, conversation);
        setMessages((previous) => [
          ...previous,
          { id: crypto.randomUUID(), role: 'assistant', content: data.reply, order: data.order },
        ]);
      } catch (err) {
        setError(err.message);
      } finally {
        setSending(false);
      }
    },
    [token],
  );

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

  const handleRetry = () => {
    if (!lastConversation.current || sending) return;
    runConversation(lastConversation.current);
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="text-2xl font-bold text-ink-900">Asistente de ventas</h2>
        <p className="text-sm text-ink-500">
          Contá qué vendiste en lenguaje natural: el asistente arma el pedido y registra la venta.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
        <div
          ref={scrollRef}
          className="grid max-h-[60vh] min-h-[320px] content-start gap-3 overflow-y-auto pr-2"
          aria-live="polite"
        >
          {messages.length === 0 && (
            <div className="grid place-items-center gap-2 py-16 text-center">
              <p className="text-sm font-semibold text-ink-700">Empezá a reportar tus ventas</p>
              <p className="max-w-md text-sm text-ink-500">
                Ejemplo: “Vendí 2 iPhone 15 y 1 Sony WH-1000XM5. El cliente se llama Maria y su
                contacto es maria@ejemplo.com”.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  message.role === 'user'
                    ? 'rounded-br-sm bg-brand-600 text-white'
                    : 'rounded-bl-sm bg-ink-100 text-ink-900'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.order && <SaleCard order={message.order} />}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-ink-100 px-4 py-2.5 text-sm text-ink-600">
                <span className="inline-flex items-end gap-1 align-middle">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-500" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-500 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-500 [animation-delay:300ms]" />
                </span>
                <span className="ml-2">escribiendo…</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={handleRetry}
              disabled={sending}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reintentar
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            placeholder="Ej: Vendí 2 iPhone 15 y 1 Sony WH-1000XM5 a Maria, maria@ejemplo.com"
            className={`${inputClass} flex-1 resize-none`}
            aria-label="Mensaje para el asistente de ventas"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="shrink-0 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
          >
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  );
}
