import { Op } from 'sequelize';
import db from '../models/index.js';

export const DEFAULT_TIER_NAME = 'Básico';

export function toPlanTierJson(tier) {
  if (!tier) return null;
  const json = tier.get ? tier.get({ plain: true }) : tier;
  return {
    id: json.id,
    name: json.name,
    price: json.price === null || json.price === undefined ? null : Number(json.price),
    productLimit: json.productLimit ?? json.product_limit ?? null,
  };
}

export function tierLimitMessage(tierName, limit) {
  return (
    `Alcanzaste el límite de ${limit} productos de tu plan ${tierName}. ` +
    'Solicitá un cambio de plan para publicar más.'
  );
}

export async function getStorePlanTier(storeOrId) {
  const storeId = typeof storeOrId === 'object' && storeOrId !== null ? storeOrId.planTierId : storeOrId;
  if (!storeId) return null;
  return db.PlanTier.findByPk(storeId);
}

export async function getDefaultPlanTier() {
  return db.PlanTier.findOne({ where: { name: DEFAULT_TIER_NAME } });
}

export async function countActiveProducts(storeId) {
  return db.Product.count({ where: { storeId, isActive: true } });
}

/**
 * Devuelve null si la tienda puede crear otro producto, o el mensaje de error
 * cuando ya alcanzó el límite de productos de su plan (product_limit null = ilimitado).
 */
export async function checkProductLimit(store) {
  const tier = await getStorePlanTier(store);
  if (!tier) return null;

  const limit = tier.productLimit ?? tier.product_limit ?? null;
  if (limit === null) return null;

  const activeProducts = await countActiveProducts(store.id);
  if (activeProducts < Number(limit)) return null;

  return tierLimitMessage(tier.name, Number(limit));
}

export async function withPlanUsage(store) {
  const tier = await getStorePlanTier(store);
  const activeProducts = await countActiveProducts(store.id);
  const limit = tier ? (tier.productLimit ?? tier.product_limit ?? null) : null;

  return {
    tier: toPlanTierJson(tier),
    activeProducts,
    productLimit: limit === null ? null : Number(limit),
    productLimitReached: limit !== null && activeProducts >= Number(limit),
  };
}

export async function findPendingPlanChangeRequest(storeId) {
  return db.PlanChangeRequest.findOne({ where: { storeId, status: 'pending' } });
}

export async function hasOtherStoreInTier(tierId, excludeStoreId) {
  const count = await db.Store.count({
    where: { planTierId: tierId, id: { [Op.ne]: excludeStoreId } },
  });
  return count > 0;
}
