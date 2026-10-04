'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE orders ADD COLUMN customer_name TEXT NULL;');
    await queryInterface.sequelize.query(
      'ALTER TABLE orders ADD COLUMN customer_contact TEXT NULL;',
    );
    await queryInterface.sequelize.query('ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE orders ALTER COLUMN user_id SET NOT NULL;');
    await queryInterface.sequelize.query(
      'ALTER TABLE orders DROP COLUMN IF EXISTS customer_contact;',
    );
    await queryInterface.sequelize.query('ALTER TABLE orders DROP COLUMN IF EXISTS customer_name;');
  },
};
