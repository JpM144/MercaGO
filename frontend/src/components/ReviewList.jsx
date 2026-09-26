import { formatDate } from '../utils/format.js';

function Stars({ rating }) {
  const filled = Math.round(Math.min(5, Math.max(0, rating ?? 0)));
  return (
    <span className="text-accent-500" aria-label={`${filled} de 5 estrellas`}>
      {'★'.repeat(filled)}
      <span className="text-ink-200">{'★'.repeat(5 - filled)}</span>
    </span>
  );
}

export default function ReviewList({ reviews = [] }) {
  if (reviews.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-10 text-center text-ink-500">
        Todavía no hay reseñas. ¡Se el primero en opinar!
      </p>
    );
  }

  return (
    <ul className="grid gap-4">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="grid gap-1.5 rounded-xl border border-ink-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
                {(review.user?.name ?? 'U').charAt(0).toUpperCase()}
              </span>
              <span className="font-medium text-ink-900">{review.user?.name ?? 'Usuario'}</span>
            </div>
            <span className="text-xs text-ink-400">{formatDate(review.created_at)}</span>
          </div>
          <Stars rating={review.rating} />
          {review.comment ? (
            <p className="text-ink-700">{review.comment}</p>
          ) : (
            <p className="text-sm italic text-ink-400">Sin comentario.</p>
          )}
        </li>
      ))}
    </ul>
  );
}
