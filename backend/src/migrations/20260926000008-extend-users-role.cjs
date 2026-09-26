'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'store_admin'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_users_role')
        ) THEN
          ALTER TYPE "enum_users_role" ADD VALUE 'store_admin';
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'super_admin'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_users_role')
        ) THEN
          ALTER TYPE "enum_users_role" ADD VALUE 'super_admin';
        END IF;
      END $$;
    `);
  },

  async down(queryInterface) {
    // Reconstruye el enum sin los roles nuevos (los usuarios con esos roles pasan a customer).
    await queryInterface.sequelize.query(
      `UPDATE users SET role = 'customer' WHERE role IN ('store_admin', 'super_admin');`,
    );
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_users_role" RENAME TO "enum_users_role_old";
      CREATE TYPE "enum_users_role" AS ENUM ('customer', 'admin');
      ALTER TABLE users ALTER COLUMN role TYPE "enum_users_role" USING role::text::"enum_users_role";
      DROP TYPE "enum_users_role_old";
    `);
  },
};
