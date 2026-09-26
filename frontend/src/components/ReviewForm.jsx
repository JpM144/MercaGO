import { useState } from 'react';
import { postReview } from '../services/products.js';
import { useAuth } from '../context/AuthContext.jsx';

function StarPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} estrella${star === 1 ? '' : 's'}`}
          onClick={() => onChange(star)}
          className={`text-2xl transition ${
            star <= value ? 'text-accent-500' : 'text-ink-200 hover:text-accent-300'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ReviewForm({ productId, alreadyReviewed, onReviewCreated }) {
  const { token } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState('');

  if (blocked) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {blocked}
      </p>
    );
  }

  if (alreadyReviewed || error === 'Ya reseñaste este producto.') {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Ya dejaste tu reseña en este producto. ¡Gracias!
      </p>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (rating === 0) {
      setError('Elegí un rating entre 1 y 5 estrellas.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const review = await postReview({
        token,
        productId,
        rating,
        comment: comment.trim() || undefined,
      });
      onReviewCreated(review);
      setRating(0);
      setComment('');
    } catch (submitError) {
      if (submitError.status === 403) {
        setBlocked(
          'Solo podés dejar una reseña si compraste este producto con un pedido confirmado o enviado.',
        );
      } else if (submitError.status === 409) {
        setError(submitError.message);
      } else {
        setError(submitError.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-4 rounded-xl border border-ink-200 bg-white p-5 shadow-sm"
    >
      <h3 className="font-semibold text-ink-900">Dejá tu reseña</h3>

      <div className="grid gap-1.5">
        <span className="text-sm font-medium text-ink-700">Calificación</span>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="review-comment" className="text-sm font-medium text-ink-700">
          Comentario (opcional)
        </label>
        <textarea
          id="review-comment"
          rows="3"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Contanos tu experiencia con este producto…"
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-fit rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
      >
        {submitting ? 'Enviando…' : 'Publicar reseña'}
      </button>
    </form>
  );
}
