import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useFavorites } from '../context/FavoritesContext.jsx';

function HeartIcon({ filled }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

export default function FavoriteButton({ product, className = '' }) {
  const { token } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const active = isFavorite(product.id);

  const handleClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!token) {
      navigate('/ingresar', {
        state: { from: location.pathname + location.search },
      });
      return;
    }
    if (pending) return;
    setPending(true);
    try {
      await toggle(product);
    } catch {
      // El estado se revierte en el contexto; no hacemos nada más.
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      disabled={pending}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm ring-1 ring-ink-200 transition hover:scale-105 disabled:opacity-60 ${
        active ? 'text-accent-600' : 'text-ink-400 hover:text-accent-600'
      } ${className}`}
    >
      <HeartIcon filled={active} />
    </button>
  );
}
