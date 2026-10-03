'use strict';

const DEFAULT_TIER_NAME = 'Básico';

const TIER_DEFAULTS = [
  { name: 'Básico', price: 50000, product_limit: 20 },
  { name: 'Estándar', price: 100000, product_limit: 50 },
  { name: 'Premium', price: 180000, product_limit: null },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('plan_tiers', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      product_limit: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    for (const tier of TIER_DEFAULTS) {
      await queryInterface.sequelize.query(
        `INSERT INTO plan_tiers (name, price, product_limit, created_at, updated_at)
         VALUES (:name, :price, :product_limit, NOW(), NOW())
         ON CONFLICT (name) DO NOTHING;`,
        { replacements: tier },
      );
    }

    await queryInterface.addColumn('stores', 'plan_tier_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'plan_tiers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Toda tienda existente (incluidas las ya aprobadas) queda en el plan Básico.
    await queryInterface.sequelize.query(
      `UPDATE stores
       SET plan_tier_id = (SELECT id FROM plan_tiers WHERE name = :tier)
       WHERE plan_tier_id IS NULL;`,
      { replacements: { tier: DEFAULT_TIER_NAME } },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('stores', 'plan_tier_id');
    await queryInterface.dropTable('plan_tiers');
  },
};
