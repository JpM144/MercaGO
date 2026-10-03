import db from '../models/index.js';
import { sendPlanChangeNotice } from '../services/mailer.js';
import { toPlanTierJson, getStorePlanTier, findPendingPlanChangeRequest } from '../utils/planTier.util.js';

const STATUSES = ['pending', 'approved', 'rejected'];

const INCLUDES = [
  { model: db.Store, as: 'store', attributes: ['id', 'name', 'slug', 'status', 'planTierId', 'ownerUserId'] },
  { model: db.PlanTier, as: 'requestedTier', attributes: ['id', 'name', 'price', 'product_limit'] },
  {
    model: db.User,
    as: 'requestedBy',
    attributes: ['id', 'name', 'email'],
    required: false,
  },
  {
    model: db.User,
    as: 'reviewedBy',
    attributes: ['id', 'name', 'email'],
    required: false,
  },
];

function toRequestJson(request) {
  const json = request.get({ plain: true });
  const store = json.store;
  const requestedTier = json.requestedTier;
  const reviewedBy = json.reviewedBy;
  const requestedBy = json.requestedBy;

  delete json.store;
  delete json.requestedTier;
  delete json.reviewedBy;
  delete json.requestedBy;

  return {
    ...json,
    price: requestedTier ? Number(requestedTier.price) : null,
    productLimit: requestedTier ? (requestedTier.product_limit ?? null) : null,
    store: store
      ? { id: store.id, name: store.name, slug: store.slug, status: store.status, planTierId: store.planTierId }
      : null,
    requestedTier: requestedTier ? toPlanTierJson(requestedTier) : null,
    requestedBy: requestedBy
      ? { id: requestedBy.id, name: requestedBy.name, email: requestedBy.email }
      : null,
    reviewedBy: reviewedBy
      ? { id: reviewedBy.id, name: reviewedBy.name, email: reviewedBy.email }
      : null,
  };
}

export async function createPlanChangeRequest(req, res, next) {
  try {
    const requestedTierId = Number(
      req.body?.requested_tier_id ?? req.body?.requestedTierId ?? req.body?.tier_id ?? req.body?.tierId,
    );

    if (!Number.isInteger(requestedTierId)) {
      return res.status(400).json({ error: 'requested_tier_id es obligatorio.' });
    }

    // El comprobante es obligatorio a nivel aplicación aunque la columna sea nullable:
    // las solicitudes viejas de prueba pueden no tener, las nuevas siempre llevan.
    if (!req.file) {
      return res.status(400).json({
        error: 'Tenés que adjuntar el comprobante de la transferencia (imagen o PDF).',
      });
    }

    const tier = await db.PlanTier.findByPk(requestedTierId);
    if (!tier) {
      return res.status(404).json({ error: 'El plan solicitado no existe.' });
    }

    const currentTier = await getStorePlanTier(req.store);
    if (currentTier && currentTier.id === tier.id) {
      return res.status(409).json({ error: `Ya estás en el plan ${tier.name}.` });
    }

    const pending = await findPendingPlanChangeRequest(req.store.id);
    if (pending) {
      return res.status(409).json({
        error: 'Ya tenés una solicitud de cambio de plan pendiente de revisión.',
        request: toRequestJson(await findRequest(pending.id)),
      });
    }

    const request = await db.PlanChangeRequest.create({
      storeId: req.store.id,
      requestedTierId: tier.id,
      requestedByUserId: req.user.id,
      status: 'pending',
      receiptUrl: `/uploads/plan-receipts/${req.file.filename}`,
    });

    return res.status(201).json({
      message: `Tu solicitud al plan ${tier.name} quedó pendiente de revisión.`,
      request: toRequestJson(await findRequest(request.id)),
    });
  } catch (error) {
    return next(error);
  }
}

async function findRequest(id) {
  return db.PlanChangeRequest.findByPk(id, { include: INCLUDES });
}

async function notifyPlanChange({ store, request, status, reason }) {
  try {
    if (!store) {
      throw new Error(`No se pudo notificar el cambio de plan: la solicitud ${request?.id} no incluye la tienda.`);
    }
    const owner = request.requestedBy ?? (await db.User.findByPk(store.ownerUserId));
    if (!owner) {
      throw new Error(
        `No se encontró un usuario para notificar el cambio de plan de "${store.name}" (storeId=${store.id}, ownerUserId=${store.ownerUserId}).`,
      );
    }

    const info = await sendPlanChangeNotice({
      store: { id: store.id, name: store.name, slug: store.slug },
      owner: { name: owner.name, email: owner.email },
      status,
      tierName: request.requestedTier?.name ?? null,
      reason: reason ?? null,
    });
    return info;
  } catch (mailError) {
    console.error(
      `[mailer] No se pudo notificar el cambio de plan de "${store?.name ?? store?.id ?? 'tienda desconocida'}":`,
      mailError.message,
    );
    return null;
  }
}

export async function listMyPlanChangeRequests(req, res, next) {
  try {
    const requests = await db.PlanChangeRequest.findAll({
      where: { storeId: req.store.id },
      order: [['createdAt', 'DESC']],
      include: INCLUDES,
    });

    return res.json({ requests: requests.map(toRequestJson) });
  } catch (error) {
    return next(error);
  }
}

export async function listPlanChangeRequests(req, res, next) {
  try {
    const { status } = req.query ?? {};

    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status inválido. Valores permitidos: ${STATUSES.join(', ')}.`,
      });
    }

    const requests = await db.PlanChangeRequest.findAll({
      where: status ? { status } : {},
      order: [['createdAt', 'DESC']],
      include: INCLUDES,
    });

    return res.json({ requests: requests.map(toRequestJson) });
  } catch (error) {
    return next(error);
  }
}

export async function approvePlanChangeRequest(req, res, next) {
  try {
    const request = await findRequest(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({ error: 'Esta solicitud ya fue procesada.' });
    }

    const store = await db.Store.findByPk(request.storeId);
    if (!store) {
      return res.status(404).json({ error: 'La tienda de la solicitud no existe.' });
    }

    const previousTierId = store.planTierId;

    await db.sequelize.transaction(async (t) => {
      await store.update({ planTierId: request.requestedTierId }, { transaction: t });

      await request.update(
        {
          status: 'approved',
          reviewedByUserId: req.user.id,
          reviewedAt: new Date(),
        },
        { transaction: t },
      );

      await db.AuditLog.create(
        {
          actorUserId: req.user.id,
          action: 'approve_plan_change',
          targetType: 'plan_change_request',
          targetId: request.id,
          details: {
            storeId: store.id,
            storeName: store.name,
            storeSlug: store.slug,
            previousTierId,
            newTierId: request.requestedTierId,
            newTierName: request.requestedTier?.name ?? null,
            actorName: req.user.name,
            actorEmail: req.user.email,
          },
        },
        { transaction: t },
      );
    });

    await notifyPlanChange({ store, request, status: 'approved' });

    return res.json({
      message: `Solicitud aprobada: ${store.name} pasó al plan ${request.requestedTier?.name}.`,
      request: toRequestJson(await findRequest(request.id)),
      store: { id: store.id, name: store.name, slug: store.slug, planTierId: request.requestedTierId },
    });
  } catch (error) {
    return next(error);
  }
}

export async function rejectPlanChangeRequest(req, res, next) {
  try {
    const request = await findRequest(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({ error: 'Esta solicitud ya fue procesada.' });
    }

    const store = request.store ?? (await db.Store.findByPk(request.storeId));
    if (!store) {
      return res.status(404).json({ error: 'La tienda de la solicitud no existe.' });
    }

    const rejectedReason = req.body?.rejected_reason ?? req.body?.rejectedReason ?? null;
    if (!rejectedReason || typeof rejectedReason !== 'string' || !rejectedReason.trim()) {
      return res.status(400).json({ error: 'rejected_reason es obligatorio al rechazar.' });
    }

    await db.sequelize.transaction(async (t) => {
      await request.update(
        {
          status: 'rejected',
          rejectedReason: rejectedReason.trim(),
          reviewedByUserId: req.user.id,
          reviewedAt: new Date(),
        },
        { transaction: t },
      );

      await db.AuditLog.create(
        {
          actorUserId: req.user.id,
          action: 'reject_plan_change',
          targetType: 'plan_change_request',
          targetId: request.id,
          details: {
            storeId: request.storeId,
            storeName: store.name,
            requestedTierId: request.requestedTierId,
            requestedTierName: request.requestedTier?.name ?? null,
            reason: rejectedReason.trim(),
            actorName: req.user.name,
            actorEmail: req.user.email,
          },
        },
        { transaction: t },
      );
    });

    await notifyPlanChange({
      store,
      request,
      status: 'rejected',
      reason: request.rejectedReason,
    });

    return res.json({
      message: 'Solicitud rechazada. La tienda mantiene su plan actual.',
      request: toRequestJson(await findRequest(request.id)),
    });
  } catch (error) {
    return next(error);
  }
}
