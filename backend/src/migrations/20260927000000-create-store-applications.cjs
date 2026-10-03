'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('store_applications', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      store_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      whatsapp_number: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      applicant_name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      applicant_email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      applicant_password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      rejected_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reviewed_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      resulting_store_id: {
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

    await queryInterface.addConstraint('store_applications', {
      fields: ['reviewed_by_user_id'],
      type: 'foreign key',
      name: 'store_applications_reviewed_by_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.addConstraint('store_applications', {
      fields: ['resulting_store_id'],
      type: 'foreign key',
      name: 'store_applications_resulting_store_id_fkey',
      references: { table: 'stores', field: 'id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('store_applications');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_store_applications_status";');
  },
};
