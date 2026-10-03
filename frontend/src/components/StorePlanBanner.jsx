import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getStoreAdminPlan } from '../services/admin.js';
import { formatDay } from '../utils/format.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(value) {
  const diffMs = new Date(value).getTime() - Date.now();
  return Math.max(1, Math.ceil(diffMs / DAY_MS));
}

export default function StorePlanBanner() {
  const { token } = useAuth();
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getStoreAdminPlan(token)
      .then((data) => {
        if (!cancelled) setPlan(data);
      })
      .catch(() => {
        if (!cancelled) setPlan(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!plan) return null;

  if (plan.planStatus === 'active' && plan.expiringSoon) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
        <p className="font-semibold text-amber-900">Tu plan vence en {daysUntil(plan.planExpiresAt)} días.</p>
        <p className="mt-1 text-sm text-amber-800">
          La vigencia termina el {formatDay(plan.planExpiresAt)}. Preparate para renovarlo antes de esa
          fecha.
        </p>
      </div>
    );
  }

  if (plan.planStatus !== 'active') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-800">
        <p className="font-semibold">Tu plan no está activo.</p>
        <p className="mt-1 text-sm">
          {plan.planStatus === 'paused' && 'Está pausado. Esperá a que un super admin lo reactive.'}
          {plan.planStatus === 'expired' && 'Venció. Renová tu plan para seguir administrando tu tienda.'}
          {plan.planStatus === 'cancelled' && 'Tu tienda fue cancelada.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
      <span className="font-semibold">Plan activo</span>
      <span aria-hidden="true">·</span>
      <span>vence el {formatDay(plan.planExpiresAt)}</span>
    </div>
  );
}