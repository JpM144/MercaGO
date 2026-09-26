'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'store_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addIndex('products', ['store_id'], { name: 'products_store_id_idx' });

    await queryInterface.addConstraint('products', {
      fields: ['store_id'],
      type: 'foreign key',
      name: 'products_store_id_fkey',
      references: { table: 'stores', field: 'id' },
      onDelete: 'CASCADE',
    });

    await queryInterface.addColumn('products', 'original_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('products', 'products_store_id_fkey');
    await queryInterface.removeIndex('products', 'products_store_id_idx');
    await queryInterface.removeColumn('products', 'store_id');
    await queryInterface.removeColumn('products', 'original_price');
  },
};
