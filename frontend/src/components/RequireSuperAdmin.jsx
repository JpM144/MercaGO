import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from './Spinner.jsx';

export default function RequireSuperAdmin({ children }) {
  const { token, user, hydrating } = useAuth();
  const location = useLocation();

  if (hydrating) {
    return <Spinner label="Verificando sesión…" />;
  }
  if (!token) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }
  if (user?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
