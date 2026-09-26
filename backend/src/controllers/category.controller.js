import db from '../models/index.js';
import { slugify, uniqueSlug } from '../utils/slug.util.js';

export async function listCategories(_req, res, next) {
  try {
    const categories = await db.Category.findAll({
      attributes: ['id', 'name', 'slug'],
      order: [['name', 'ASC']],
    });
    return res.json({ categories });
  } catch (error) {
    return next(error);
  }
}

export async function createCategory(req, res, next) {
  try {
    const { name } = req.body ?? {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name es obligatorio.' });
    }

    const slug = await uniqueSlug(db.Category, slugify(name));
    const category = await db.Category.create({ name, slug });

    return res.status(201).json({ category });
  } catch (error) {
    return next(error);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const category = await db.Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Categoría no encontrada.' });
    }

    const { name, slug } = req.body ?? {};
    const fields = {};

    if (name !== undefined) {
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'name debe ser un texto no vacío.' });
      }
      fields.name = name;
      if (slug === undefined) {
        fields.slug = await uniqueSlug(db.Category, slugify(name), { excludeId: category.id });
      }
    }
    if (slug !== undefined) {
      fields.slug = await uniqueSlug(db.Category, slugify(slug), { excludeId: category.id });
    }

    await category.update(fields);
    return res.json({ category });
  } catch (error) {
    return next(error);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    const category = await db.Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Categoría no encontrada.' });
    }

    const productCount = await db.Product.count({ where: { categoryId: category.id } });
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
