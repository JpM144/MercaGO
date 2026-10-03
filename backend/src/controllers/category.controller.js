import db from '../models/index.js';
import { slugify, uniqueSlug } from '../utils/slug.util.js';

const CATEGORY_FIELDS = ['id', 'name', 'slug'];

/**
 * Lista pública del marketplace: los nombres de categoría que existen entre todas
 * las tiendas. Al ser categorías privadas por tienda, la misma "Celulares" puede ser
 * una fila distinta en cada tienda, así que el filtro global matchea por NOMBRE.
 */
export async function listCategories(_req, res, next) {
  try {
    // `group` y no `distinct`: Sequelize sólo aplica DISTINCT cuando hay `include`.
    const categories = await db.Category.findAll({
      attributes: ['name'],
      group: ['name'],
      order: [['name', 'ASC']],
    });
    return res.json({ categories });
  } catch (error) {
    return next(error);
  }
}

export async function listStoreCategories(req, res, next) {
  try {
    const categories = await db.Category.findAll({
      where: { storeId: req.store.id },
      attributes: CATEGORY_FIELDS,
      order: [['name', 'ASC']],
    });
    return res.json({ categories });
  } catch (error) {
    return next(error);
  }
}

export async function createStoreCategory(req, res, next) {
  try {
    const { name } = req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name es obligatorio.' });
    }

    const scope = { storeId: req.store.id };
    const slug = await uniqueSlug(db.Category, slugify(name), { where: scope });
    const category = await db.Category.create({ name: name.trim(), slug, ...scope });

    return res.status(201).json({ category });
  } catch (error) {
    return next(error);
  }
}

/** Sólo encuentra categorías de la tienda del store_admin: adivinar un id ajeno da 404. */
async function findOwnCategory(req) {
  return db.Category.findOne({ where: { id: req.params.id, storeId: req.store.id } });
}

export async function updateStoreCategory(req, res, next) {
  try {
    const category = await findOwnCategory(req);
    if (!category) {
      return res.status(404).json({ error: 'Categoría no encontrada.' });
    }

    const { name, slug } = req.body ?? {};
    const fields = {};
    const scope = { storeId: req.store.id };

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name debe ser un texto no vacío.' });
      }
      fields.name = name.trim();
      if (slug === undefined) {
        fields.slug = await uniqueSlug(db.Category, slugify(name), {
          where: scope,
          excludeId: category.id,
        });
      }
    }
    if (slug !== undefined) {
      fields.slug = await uniqueSlug(db.Category, slugify(slug), {
        where: scope,
        excludeId: category.id,
      });
    }

    await category.update(fields);
    return res.json({ category });
  } catch (error) {
    return next(error);
  }
}

export async function deleteStoreCategory(req, res, next) {
  try {
    const category = await findOwnCategory(req);
    if (!category) {
      return res.status(404).json({ error: 'Categoría no encontrada.' });
    }

    const productCount = await db.Product.count({
      where: { categoryId: category.id, storeId: req.store.id },
    });
    if (productCount > 0) {
      return res.status(409).json({
        error: `No se puede eliminar la categoría "${category.name}": tiene ${productCount} producto(s) asociado(s).`,
      });
    }

    await category.destroy();
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
