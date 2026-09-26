import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { fetchProductBySlug } from '../services/products.js';
import { productHref } from '../utils/links.js';
import Spinner from '../components/Spinner.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

export default function ProductRedirectPage() {
  const { slug } = useParams();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, target: null, error: null });

  const load = useCallback(async () => {
    setState({ loading: true, target: null, error: null });
    try {
      const data = await fetchProductBySlug(slug);
      const target = productHref(data.product);
      setState({
        loading: false,
        target,
        error: target.startsWith('/products/') ? 'El producto no tiene tienda asignada.' : null,
      });
    } catch (error) {
      setState({ loading: false, target: null, error: error.message });
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load, attempt]);

  if (state.target) {
    return <Navigate to={state.target} replace />;
  }

  if (state.loading) {
    return <Spinner label="Redirigiendo al producto…" />;
  }

  return (
    <div className="grid gap-4">
      <ErrorBanner message={state.error} onRetry={() => setAttempt((value) => value + 1)} />
      <Link to="/" className="text-sm font-medium text-brand-700 hover:text-brand-800">
        Volver al marketplace
      </Link>
    </div>
  );
}
