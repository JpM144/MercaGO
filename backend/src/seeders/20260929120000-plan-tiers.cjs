'use strict';

const DEFAULT_TIER_NAME = 'Básico';

const TIERS = [
  { name: 'Básico', price: 50000, product_limit: 20 },
  { name: 'Estándar', price: 100000, product_limit: 50 },
  { name: 'Premium', price: 180000, product_limit: null },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Upsert por nombre: se puede volver a correr para ajustar precios o límites.
    for (const tier of TIERS) {
      await queryInterface.sequelize.query(
        `INSERT INTO plan_tiers (name, price, product_limit, created_at, updated_at)
         VALUES (:name, :price, :product_limit, NOW(), NOW())
         ON CONFLICT (name) DO UPDATE SET
           price = EXCLUDED.price,
           product_limit = EXCLUDED.product_limit,
           updated_at = NOW();`,
        { replacements: tier },
      );
    }

    await queryInterface.sequelize.query(
      `UPDATE stores
       SET plan_tier_id = (SELECT id FROM plan_tiers WHERE name = :tier)
       WHERE plan_tier_id IS NULL;`,
      { replacements: { tier: DEFAULT_TIER_NAME } },
    );

    console.log(
      `[seed] Planes cargados: ${TIERS.map((t) => `${t.name} ($${t.price}/mes, ${t.product_limit ?? 'sin limite'})`).join(', ')}.`,
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('plan_tiers', null, {});
  },
};
