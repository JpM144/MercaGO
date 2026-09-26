import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';

export default function StoreStatusPage() {
  const { token, user, hydrating, logout } = useAuth();

  if (hydrating) {
    return <Spinner label="Verificando sesión…" />;
  }
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== 'store_admin') {
    return <Navigate to="/" replace />;
  }
  if (user.storeStatus === 'approved') {
    return <Navigate to="/admin" replace />;
  }

  const rejected = user.storeStatus === 'rejected';

  return (
    <div className="mx-auto grid w-full max-w-lg gap-6 py-8">
      <div
        className={`grid gap-4 rounded-xl border p-6 text-center shadow-sm ${
          rejected ? 'border-red-200 bg-red-50' : 'border-brand-200 bg-brand-50'
        }`}
      >
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">
          {rejected ? 'Tu tienda fue rechazada' : 'Tu tienda está en revisión'}
        </h1>

        {rejected ? (
          <div className="grid gap-2 text-sm leading-relaxed text-ink-700">
            <p>Lamentablemente, tu solicitud de registro de tienda fue rechazada.</p>
            {user.storeRejectedReason && (
              <p className="rounded-lg bg-white/70 px-4 py-3 text-ink-800">
                <span className="font-semibold">Motivo:</span> {user.storeRejectedReason}
              </p>
            )}
            <p>Podés volver a intentar registrando tu tienda con una nueva solicitud.</p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-ink-700">
            Recibimos tu solicitud de registro. La revisaremos y te notificaremos por email cuando
            tu tienda esté aprobada o si necesitamos más información. Mientras tanto, tu tienda no
            aparece en el marketplace.
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {rejected ? (
          <Link
            to="/registrar"
            className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Volver a intentar
          </Link>
        ) : (
          <Link
            to="/"
            className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Volver al marketplace
          </Link>
        )}
        <button
          type="button"
          onClick={logout}
          className="rounded-xl border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
