import { useEffect, useState } from 'react';
import { postReview } from '../services/products.js';
import { useAuth } from '../context/AuthContext.jsx';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

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
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (alreadyReviewed || error === 'Ya reseñaste este producto.') {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Ya dejaste tu reseña en este producto. ¡Gracias!
      </p>
    );
  }

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setError('');
    if (!file) {
      setPhoto(null);
      setPreviewUrl(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('La foto debe ser JPG, PNG o WebP.');
      setPhoto(null);
      setPreviewUrl(null);
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setError('La foto no puede superar los 5 MB.');
      setPhoto(null);
      setPreviewUrl(null);
      return;
    }
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (rating === 0) {
      setError('Elegí un rating entre 1 y 5 estrellas.');
      return;
    }
    if (!photo) {
      setError('La foto del producto es obligatoria.');
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
        photo,
      });
      onReviewCreated(review);
      setRating(0);
      setComment('');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPhoto(null);
      setPreviewUrl(null);
    } catch (submitError) {
      if (submitError.status === 401 || submitError.status === 403) {
        setError('Necesitás iniciar sesión para dejar una reseña.');
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

      <div className="grid gap-1.5">
        <label htmlFor="review-photo" className="text-sm font-medium text-ink-700">
          Foto del producto (obligatoria)
        </label>
        <input
          id="review-photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoChange}
          className="block w-full cursor-pointer rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
        />
        <p className="text-xs text-ink-400">Formatos JPG, PNG o WebP. Tamaño máximo 5 MB.</p>
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Vista previa de la foto de tu reseña"
            className="mt-1 max-h-52 w-fit rounded-lg border border-ink-200 object-cover"
          />
        )}
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