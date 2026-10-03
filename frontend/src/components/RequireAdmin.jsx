import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from './Spinner.jsx';
import NonActivePlanScreen from './NonActivePlanScreen.jsx';

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
  const isStoreAdmin = user?.role === 'store_admin';
  const isApprovedStoreAdmin = isStoreAdmin && user?.storeStatus === 'approved';

  if (!isSuperAdmin && !isApprovedStoreAdmin) {
    return <Navigate to="/" replace />;
  }

  if (isStoreAdmin && user?.planStatus && user.planStatus !== 'active') {
    return (
      <NonActivePlanScreen planStatus={user.planStatus} planExpiresAt={user.planExpiresAt} />
    );
  }

  return children;
}