'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('stores', 'plan_status', {
      type: Sequelize.ENUM('active', 'paused', 'cancelled', 'expired'),
      allowNull: false,
      defaultValue: 'active',
    });
    await queryInterface.addColumn('stores', 'plan_started_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('stores', 'plan_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Backfill para tiendas existentes: el plan arranca cuando se creó la tienda
    // y vence un mes después (el vencimiento se deriva, no se escribe por cron).
    await queryInterface.sequelize.query(
      `UPDATE stores
       SET plan_started_at = created_at,
           plan_expires_at = created_at + INTERVAL '1 month'
       WHERE plan_started_at IS NULL;`,
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('stores', 'plan_status');
    await queryInterface.removeColumn('stores', 'plan_started_at');
    await queryInterface.removeColumn('stores', 'plan_expires_at');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stores_plan_status";');
  },
};
