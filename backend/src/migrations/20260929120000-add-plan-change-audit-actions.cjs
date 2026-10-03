'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_audit_logs_action" ADD VALUE IF NOT EXISTS 'approve_plan_change';`,
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_audit_logs_action" ADD VALUE IF NOT EXISTS 'reject_plan_change';`,
    );
  },

  async down() {
    // Los valores de un enum no se pueden quitar en PostgreSQL.
  },
};
