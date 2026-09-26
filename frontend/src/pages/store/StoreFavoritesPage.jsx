import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFavorites } from '../../context/FavoritesContext.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import ProductGrid from '../../components/ProductGrid.jsx';
import Spinner from '../../components/Spinner.jsx';

export default function StoreFavoritesPage() {
  const { token } = useAuth();
  const { favoriteProducts, loading } = useFavorites();
  const store = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!token) {
      navigate('/ingresar', { state: { from: location.pathname }, replace: true });
    }
  }, [token, navigate, location.pathname]);

  if (!token) return null;

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">Tus favoritos</h2>
        <p className="text-sm text-ink-500">Los productos que guardaste para tenerlos a mano.</p>
      </div>

      {loading ? (
        <Spinner label="Cargando favoritos…" />
      ) : favoriteProducts.length > 0 ? (
        <ProductGrid products={favoriteProducts} />
      ) : (
        <div className="grid gap-4 rounded-xl border border-dashed border-ink-300 bg-white px-6 py-14 text-center">
          <div className="grid gap-1">
            <h3 className="text-lg font-bold text-ink-900">Todavía no tenés favoritos</h3>
            <p className="mx-auto max-w-md text-ink-500">
              Tocá el corazón en cualquier producto de {store.name} para guardarlo acá.
            </p>
          </div>
          <Link
            to={`/tienda/${store.slug}/categorias`}
            className="mx-auto rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Explorar el catálogo
          </Link>
        </div>
      )}
    </div>
  );
}
