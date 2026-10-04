'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      actor_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      action: {
        type: Sequelize.ENUM(
          'approve_application',
          'reject_application',
          'pause_store',
          'reactivate_store',
          'cancel_store',
        ),
        allowNull: false,
      },
      target_type: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },
      target_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      details: {
        type: Sequelize.JSONB,
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

    await queryInterface.addConstraint('audit_logs', {
      fields: ['actor_user_id'],
      type: 'foreign key',
      name: 'audit_logs_actor_user_id_fkey',
      references: { table: 'users', field: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('audit_logs', ['action'], {
      name: 'audit_logs_action_idx',
    });
    await queryInterface.addIndex('audit_logs', ['created_at'], {
      name: 'audit_logs_created_at_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_audit_logs_action";');
  },
};
