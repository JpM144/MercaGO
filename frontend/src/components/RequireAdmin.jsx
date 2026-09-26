import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from './Spinner.jsx';

export default function RequireAdmin({ children }) {
  const { token, user, hydrating } = useAuth();
  const location = useLocation();

  if (hydrating) {
    return <Spinner label="Verificando sesión…" />;
  }
  if (!token) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  const isSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isApprovedStoreAdmin = user?.role === 'store_admin' && user?.storeStatus === 'approved';

  if (!isSuperAdmin && !isApprovedStoreAdmin) {
    return user?.role === 'store_admin' ? (
      <Navigate to="/estado-tienda" replace />
    ) : (
      <Navigate to="/" replace />
    );
  }

  return children;
}
