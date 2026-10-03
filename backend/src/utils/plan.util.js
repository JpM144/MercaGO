import { Op } from 'sequelize';

export const PLAN_STATUSES = ['active', 'paused', 'cancelled', 'expired'];

const EXPIRING_SOON_MS = 2 * 24 * 60 * 60 * 1000;

function readField(store, camel, snake) {
  if (store == null) return undefined;
  if (store[camel] !== undefined) return store[camel];
  if (store[snake] !== undefined) return store[snake];
  if (typeof store.get === 'function') {
    try {
      return store.get(camel);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function getEffectivePlanStatus(store) {
  const manual = readField(store, 'planStatus', 'plan_status') ?? 'active';

  if (manual === 'paused' || manual === 'cancelled' || manual === 'expired') {
    return { status: manual, expiringSoon: false };
  }

  const expiresAt = readField(store, 'planExpiresAt', 'plan_expires_at');
  if (!expiresAt) {
    return { status: 'active', expiringSoon: false };
  }

  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (msLeft <= 0) {
    return { status: 'expired', expiringSoon: false };
  }

  return { status: 'active', expiringSoon: msLeft <= EXPIRING_SOON_MS };
}

export function addOneMonth(date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export function activePlanWhere() {
  return {
    planStatus: 'active',
    [Op.or]: [{ planExpiresAt: null }, { planExpiresAt: { [Op.gt]: new Date() } }],
  };
}