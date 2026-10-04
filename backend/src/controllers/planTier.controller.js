import db from '../models/index.js';
import { toPlanTierJson } from '../utils/planTier.util.js';

export async function listPlanTiers(req, res, next) {
  try {
    const tiers = await db.PlanTier.findAll({
      order: [
        ['price', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    return res.json({
      tiers: tiers.map(toPlanTierJson),
      defaultTierName: tiers[0]?.name ?? null,
    });
  } catch (error) {
    return next(error);
  }
}
