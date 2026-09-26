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
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}
