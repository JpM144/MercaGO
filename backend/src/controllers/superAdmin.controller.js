import { Op } from 'sequelize';
import db from '../models/index.js';
import { PLAN_STATUSES, getEffectivePlanStatus } from '../utils/plan.util.js';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS, buildAuditSummary } from '../utils/audit.util.js';

function toPlanStoreJson(store, plan) {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    status: store.status,
    ownerUserId: store.ownerUserId ?? null,
    owner: store.owner ?? null,
    planStatus: plan.status,
    expiringSoon: plan.expiringSoon,
    planStartedAt: store.planStartedAt ?? null,
    planExpiresAt: store.planExpiresAt ?? null,
  };
}

async function findPlanStore(id) {
  return db.Store.findByPk(id, {
    attributes: ['id', 'name', 'slug', 'status', 'planStatus', 'planStartedAt', 'planExpiresAt'],
  });
}

export async function listStores(req, res, next) {
  try {
    const stores = await db.Store.findAll({
      attributes: [
        'id',
        'name',
        'slug',
        'status',
        'planStatus',
        'planStartedAt',
        'planExpiresAt',
        'createdAt',
      ],
      include: [{ model: db.User, as: 'owner', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      stores: stores.map((store) => {
        const plain = store.get({ plain: true });
        const plan = getEffectivePlanStatus(plain);
        return toPlanStoreJson(plain, plan);
      }),
    });
  } catch (error) {
    return next(error);
  }
}

async function changePlanStatus(req, res, next, planStatus, auditAction) {
  try {
    if (!PLAN_STATUSES.includes(planStatus)) {
      return res.status(400).json({ error: 'planStatus inválido.' });
    }
    if (!AUDIT_ACTIONS.includes(auditAction)) {
      return res.status(400).json({ error: 'action de auditoría inválido.' });
    }

    const store = await findPlanStore(req.params.id);
    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada.' });
    }

    await db.sequelize.transaction(async (t) => {
      await store.update({ planStatus }, { transaction: t });

      await db.AuditLog.create(
        {
          actorUserId: req.user.id,
          action: auditAction,
          targetType: 'store',
          targetId: store.id,
          details: {
            targetName: store.name,
            targetSlug: store.slug,
            planStatus,
            actorName: req.user.name,
            actorEmail: req.user.email,
          },
        },
        { transaction: t },
      );
    });

    const plain = store.get({ plain: true });
    const plan = getEffectivePlanStatus(plain);

    return res.json({ store: toPlanStoreJson(plain, plan) });
  } catch (error) {
    return next(error);
  }
}

export function pauseStore(req, res, next) {
  return changePlanStatus(req, res, next, 'paused', 'pause_store');
}

export function reactivateStore(req, res, next) {
  return changePlanStatus(req, res, next, 'active', 'reactivate_store');
}

export function cancelStore(req, res, next) {
  return changePlanStatus(req, res, next, 'cancelled', 'cancel_store');
}

export async function listAuditLogs(req, res, next) {
  try {
    const { action, from, to } = req.query ?? {};
    const where = {};

    if (action !== undefined && action !== '') {
      if (!AUDIT_ACTIONS.includes(action)) {
        return res.status(400).json({
          error: `action inválido. Valores permitidos: ${AUDIT_ACTIONS.join(', ')}.`,
        });
      }
      where.action = action;
    }

    const fromDate = from !== undefined && from !== '' ? new Date(from) : null;
    const toDate = to !== undefined && to !== '' ? new Date(to) : null;

    if (fromDate && Number.isNaN(fromDate.getTime())) {
      return res.status(400).json({ error: 'from inválido. Usá una fecha ISO.' });
    }
    if (toDate && Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'to inválido. Usá una fecha ISO.' });
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt[Op.gte] = fromDate;
      if (toDate) where.createdAt[Op.lte] = toDate;
    }

    const logs = await db.AuditLog.findAll({
      where,
      include: [
        {
          model: db.User,
          as: 'actor',
          attributes: ['id', 'name', 'email'],
          required: false,
        },
      ],
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });

    return res.json({
      logs: logs.map((log) => {
        const plain = log.get({ plain: true });
        const details = plain.details ?? {};
        return {
          id: plain.id,
          action: plain.action,
          actionLabel: AUDIT_ACTION_LABELS[plain.action] ?? plain.action,
          summary: buildAuditSummary(plain.action, details),
          targetType: plain.targetType,
          targetId: plain.targetId,
          details,
          createdAt: plain.createdAt,
          actor: plain.actor
            ? { id: plain.actor.id, name: plain.actor.name, email: plain.actor.email }
            : details.actorEmail
              ? { name: details.actorName ?? null, email: details.actorEmail, id: null }
              : null,
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
}
