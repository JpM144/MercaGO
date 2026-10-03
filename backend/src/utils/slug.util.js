import { Op } from 'sequelize';

export function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function uniqueSlug(model, base, { excludeId, where: scope } = {}) {
  const root = base || 'item';
  let candidate = root;
  let i = 2;

  const where = { ...scope, slug: candidate };
  if (excludeId !== undefined) {
    where.id = { [Op.ne]: excludeId };
  }

  while (await model.findOne({ where })) {
    candidate = `${root}-${i}`;
    where.slug = candidate;
    i += 1;
  }

  return candidate;
}
