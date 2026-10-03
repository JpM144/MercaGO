'use strict';

/**
 * Categorías privadas por tienda.
 *
 * 1. agrega `categories.store_id` (nullable al principio)
 * 2. asigna las categorías sin dueño a la tienda real (Mac Center)
 * 3. reemplaza el UNIQUE global de `slug` por uno compuesto (store_id, slug)
 * 4. deja `store_id` NOT NULL
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('categories', 'store_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'stores', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Las categorías que existían eran compartidas: se las queda la única tienda real.
    await queryInterface.sequelize.query(`
      UPDATE categories
      SET store_id = COALESCE(
        (SELECT id FROM stores WHERE slug = 'mac-center' LIMIT 1),
        (SELECT id FROM stores ORDER BY id LIMIT 1)
      )
      WHERE store_id IS NULL;
    `);

    const [[orphans]] = await queryInterface.sequelize.query(
      'SELECT COUNT(*)::int AS total FROM categories WHERE store_id IS NULL;',
    );
    if (orphans.total > 0) {
      throw new Error(
        `No se puede dejar categories.store_id NOT NULL: ${orphans.total} categoría(s) sin tienda. ` +
          'Asignales una tienda antes de correr esta migración.',
      );
    }

    // El slug deja de ser único en todo el marketplace: pasa a serlo por tienda.
    await queryInterface.removeConstraint('categories', 'categories_slug_key');
    await queryInterface.addIndex('categories', ['store_id', 'slug'], {
      unique: true,
      name: 'categories_store_id_slug_key',
    });

    await queryInterface.changeColumn('categories', 'store_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'stores', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface) {
    // Dos tiendas pueden compartir slug: hay que desambiguar para volver al UNIQUE global.
    await queryInterface.sequelize.query(`
      UPDATE categories c
      SET slug = c.slug || '-' || c.store_id
      WHERE EXISTS (
        SELECT 1 FROM categories o
        WHERE o.slug = c.slug AND o.store_id <> c.store_id
      );
    `);

    await queryInterface.removeIndex('categories', 'categories_store_id_slug_key');
    await queryInterface.addConstraint('categories', {
      fields: ['slug'],
      type: 'unique',
      name: 'categories_slug_key',
    });
    await queryInterface.removeColumn('categories', 'store_id');
  },
};
