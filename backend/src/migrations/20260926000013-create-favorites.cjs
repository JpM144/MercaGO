'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('favorites', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('favorites', ['user_id', 'product_id'], {
      unique: true,
      name: 'favorites_user_product_unique',
    });

    await queryInterface.addConstraint('favorites', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'favorites_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'CASCADE',
    });

    await queryInterface.addConstraint('favorites', {
      fields: ['product_id'],
      type: 'foreign key',
      name: 'favorites_product_id_fkey',
      references: { table: 'products', field: 'id' },
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('favorites');
  },
};
