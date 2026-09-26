import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import {
  addFavorite as apiAddFavorite,
  listFavorites,
  removeFavorite as apiRemoveFavorite,
} from '../services/favorites.js';

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { token } = useAuth();
  const [favoriteProducts, setFavoriteProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (!token) {
      setFavoriteProducts([]);
      setLoading(false);
      return;
    }
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const data = await listFavorites(token);
      setFavoriteProducts((data.favorites ?? []).map((favorite) => favorite.product));
    } catch {
      setFavoriteProducts([]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const isFavorite = useCallback(
    (productId) => favoriteProducts.some((product) => product.id === productId),
    [favoriteProducts],
  );

  const toggle = useCallback(
    async (product) => {
      if (!token) throw new Error('Sesión requerida.');
      const wasFavorite = favoriteProducts.some((item) => item.id === product.id);

      if (wasFavorite) {
        setFavoriteProducts((prev) => prev.filter((item) => item.id !== product.id));
        try {
          await apiRemoveFavorite(token, product.id);
        } catch (error) {
          setFavoriteProducts((prev) =>
            prev.some((item) => item.id === product.id) ? prev : [product, ...prev],
          );
          throw error;
        }
      } else {
        setFavoriteProducts((prev) =>
          prev.some((item) => item.id === product.id) ? prev : [product, ...prev],
        );
        try {
          await apiAddFavorite(token, product.id);
        } catch (error) {
          setFavoriteProducts((prev) => prev.filter((item) => item.id !== product.id));
          throw error;
        }
      }
    },
    [token, favoriteProducts],
  );

  return (
    <FavoritesContext.Provider
      value={{ favoriteProducts, loading, isFavorite, toggle, refresh: load }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
