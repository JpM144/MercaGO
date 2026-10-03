import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDay } from '../utils/format.js';

const PLAN_COPY = {
  paused: {
    title: 'Tu tienda está pausada',
    message: 'Esperá a que un super admin la reactive para continuar administrándola.',
  },
  expired: {
    title: 'Tu plan venció',
    message: 'Renová tu plan para seguir administrando tu tienda y volver a vender.',
  },
  cancelled: {
    title: 'Tu tienda fue cancelada',
    message: 'Contactá al soporte si querés retomar la venta en la plataforma.',
  },
};

export default function NonActivePlanScreen({ planStatus, planExpiresAt }) {
  const { user, logout } = useAuth();
  const copy = PLAN_COPY[planStatus] ?? PLAN_COPY.cancelled;

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="mx-auto grid w-full max-w-lg gap-6 py-10">
      <div className="grid gap-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">{copy.title}</h1>
        <p className="text-ink-500">{copy.message}</p>
      </div>

      <div className="grid gap-4 rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
        <div className="grid gap-1 border-b border-ink-100 pb-4">
          <p className="text-sm font-semibold text-ink-900">{user?.name}</p>
          <p className="truncate text-xs text-ink-500">{user?.email}</p>
        </div>
        <div className="grid gap-1 text-sm">
          <p className="text-ink-500">Estado del plan:</p>
          <p className="capitalize font-semibold text-ink-900">
            {planStatus === 'paused' && 'Pausada'}
            {planStatus === 'expired' && 'Vencido'}
            {planStatus === 'cancelled' && 'Cancelada'}
          </p>
          {planExpiresAt && (
            <p className="text-xs text-ink-400">
              {planStatus === 'expired' ? 'Vencía el' : 'Válido hasta el'} {formatDay(planExpiresAt)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            to="/"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Volver al marketplace
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-50"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}