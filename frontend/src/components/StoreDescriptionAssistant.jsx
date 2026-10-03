import { useState } from 'react';
import { sendStoreApplicationAssistantMessage } from '../services/storeApplicationAssistant.js';

export default function StoreDescriptionAssistant({ onApply, applied }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState(null);

  const askForSuggestion = async () => {
    const firstMessage = prompt.trim();
    if (!firstMessage || loading) return;

    setLoading(true);
    setError('');
    setSuggestion(null);
    try {
      const data = await sendStoreApplicationAssistantMessage([
        { role: 'user', content: firstMessage },
      ]);
      if (data.suggestedDescription) {
        setSuggestion({
          description: data.suggestedDescription,
          category: data.suggestedCategory ?? null,
        });
      } else {
        setError(
          'La IA no pudo armar una sugerencia con esa información. Probá contándonos un poco más de tu negocio.',
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4">
      <div className="grid gap-1">
        <p className="text-sm font-semibold text-ink-900">
          ¿No sabes cómo escribir la descripción?
        </p>
        <p className="text-xs text-ink-600">
          Cuentanos brevemente de qué se trata tu negocio y te proponemos una descripción. Puedes
          editarla después.
        </p>
      </div>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        rows={2}
        placeholder="Ej: Vendo fundas y accesorios para celular en Medellín"
        aria-label="Cuentanos brevemente de qué se trata tu negocio"
        className="w-full resize-none rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={askForSuggestion}
          disabled={loading || !prompt.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
        >
          {loading && (
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden="true"
            />
          )}
          {loading ? 'Generando sugerencia…' : 'Sugerir descripción'}
        </button>
        {applied && !loading && (
          <span className="text-xs text-ink-500">Sugerencia aplicada ✅</span>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {suggestion && (
        <div className="grid gap-2 rounded-lg border border-ink-200 bg-white p-3">
          <p className="text-xs text-ink-500">Sugerencia de la IA</p>
          <p className="whitespace-pre-wrap text-sm text-ink-900">{suggestion.description}</p>
          {suggestion.category && (
            <p className="text-xs text-ink-500">
              Categoría principal sugerida: {suggestion.category}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onApply(suggestion.description)}
              disabled={loading}
              className="rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Usar esta sugerencia
            </button>
            <button
              type="button"
              onClick={() => {
                setSuggestion(null);
                setPrompt('');
              }}
              disabled={loading}
              className="rounded-lg px-3 py-2 text-sm text-ink-600 transition hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
