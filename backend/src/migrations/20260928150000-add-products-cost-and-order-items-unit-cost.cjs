'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn('products', 'cost', {
      type: queryInterface.sequelize.Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('order_items', 'unit_cost', {
      type: queryInterface.sequelize.Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE order_items DROP COLUMN IF EXISTS unit_cost;',
    );
    await queryInterface.sequelize.query('ALTER TABLE products DROP COLUMN IF EXISTS cost;');
  },
};