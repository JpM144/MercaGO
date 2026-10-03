import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext.jsx';
import { fetchStoreFeaturedProducts } from '../../services/stores.js';
import ProductCard from '../../components/ProductCard.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorBanner from '../../components/ErrorBanner.jsx';

function Badge({ icon, title, description }) {
  return (
    <div className="grid gap-2 rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-xl text-brand-700">
        {icon}
      </span>
      <h3 className="font-bold text-ink-900">{title}</h3>
      <p className="text-sm text-ink-500">{description}</p>
    </div>
  );
}

export default function StoreHomePage() {
  const store = useStore();
  const [featured, setFeatured] = useState({ loading: true, products: [], error: null });

  const loadFeatured = useCallback(async () => {
    setFeatured({ loading: true, products: [], error: null });
    try {
      const data = await fetchStoreFeaturedProducts(store.slug);
      setFeatured({ loading: false, products: data.products ?? [], error: null });
    } catch (error) {
      setFeatured({ loading: false, products: [], error: error.message });
    }
  }, [store.slug]);

  useEffect(() => {
    loadFeatured();
  }, [loadFeatured]);

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 rounded-2xl bg-gradient-to-br from-brand-800 to-brand-950 p-8 text-white shadow-sm md:p-10">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500 text-4xl font-black text-brand-950">
          {store.name.charAt(0).toUpperCase()}
        </span>
        <div className="grid max-w-2xl gap-2">
          <h2 className="text-3xl font-bold tracking-tight">Bienvenidos a {store.name}</h2>
          <p className="text-brand-100">
            {store.description || 'Productos seleccionados con la mejor relación calidad-precio.'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Badge
          icon="🛡️"
          title="Compra segura"
          description={
            store.paymentMethods ?? 'Paga con los métodos de pago que prefieras, con tranquilidad.'
          }
        />
        <Badge
          icon="🚚"
          title="Envíos"
          description={store.shippingInfo ?? 'Consulta por los envíos disponibles a tu zona.'}
        />
        <Badge
          icon="🧾"
          title="Garantía"
          description={store.warrantyInfo ?? 'Productos con garantía. Consulta las condiciones.'}
        />
      </div>

      <section className="grid gap-5">
        <div className="flex items-end justify-between gap-4">
          <div className="grid gap-1">
            <h2 className="text-2xl font-bold tracking-tight text-ink-900">Productos destacados</h2>
            <p className="text-sm text-ink-500">Lo más nuevo y vendido de {store.name}.</p>
          </div>
          <Link
            to={`/tienda/${store.slug}/categorias`}
            className="shrink-0 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Ver categorías →
          </Link>
        </div>

        {featured.loading && <Spinner label="Cargando destacados…" />}

        {!featured.loading && featured.error && (
          <ErrorBanner message={featured.error} onRetry={loadFeatured} />
        )}

        {!featured.loading && !featured.error && (
          <>
            {featured.products.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {featured.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center text-ink-500">
                Todavía no hay productos destacados en esta tienda. ¡Vuelve pronto!
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
