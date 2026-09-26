'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stores', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      whatsapp_number: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      owner_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      business_hours: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      shipping_info: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      warranty_info: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      payment_methods: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      rejected_reason: {
        type: Sequelize.TEXT,
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

    await queryInterface.addConstraint('stores', {
      fields: ['owner_user_id'],
      type: 'foreign key',
      name: 'stores_owner_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stores');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stores_status";');
  },
};
