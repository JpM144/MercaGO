'use strict';

require('dotenv').config();

const DEFAULT_WHATSAPP = '+5491100000000';
const PLACEHOLDER_PASSWORD = 'secret123';

async function createUserIfMissing(seq, { name, email, role }) {
  const [[existing]] = await seq.query('SELECT id FROM users WHERE email = :email LIMIT 1;', {
    replacements: { email },
  });
  if (existing) {
    return existing.id;
  }

  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash(PLACEHOLDER_PASSWORD, 10);

  const [[inserted]] = await seq.query(
    `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
     VALUES (:name, :email, :hash, :role, NOW(), NOW())
     ON CONFLICT (email) DO NOTHING
     RETURNING id;`,
    { replacements: { name, email, hash, role } },
  );

  console.log(
    `[migracion:backfill] Usuario placeholder creado: ${email} (${role}) / password: ${PLACEHOLDER_PASSWORD}`,
  );
  return inserted.id;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const seq = queryInterface.sequelize;

    // 1) Los admins existentes pasan a store_admin.
    await seq.query(
      `UPDATE users SET role = 'store_admin', updated_at = NOW() WHERE role = 'admin';`,
    );

    // 2) Dueño de la tienda original: el primer store_admin (antes admin). Si no existe, placeholder.
    const [owners] = await seq.query(
      `SELECT id FROM users WHERE role = 'store_admin' ORDER BY id ASC LIMIT 1;`,
    );
    let ownerId;
    if (owners[0]) {
      ownerId = owners[0].id;
    } else {
      ownerId = await createUserIfMissing(seq, {
        name: 'Dueño TechStore',
        email: 'admin@techstore.com',
        role: 'store_admin',
      });
    }

    // 3) Tienda "TechStore" aprobada, paga la tienda del owner original.
    const whatsapp = process.env.DEFAULT_STORE_WHATSAPP || DEFAULT_WHATSAPP;
    await seq.query(
      `INSERT INTO stores
         (name, slug, whatsapp_number, description, owner_user_id, status,
          business_hours, shipping_info, warranty_info, payment_methods, created_at, updated_at)
       VALUES (:name, :slug, :whatsapp, :desc, :owner, 'approved',
          :hours, :shipping, :warranty, :payments, NOW(), NOW())
       ON CONFLICT (slug) DO NOTHING;`,
      {
        replacements: {
          name: 'TechStore',
          slug: 'techstore',
          whatsapp,
          desc: 'Tienda oficial de TechStore.',
          owner: ownerId,
          hours: 'Lunes a sábado 9:00-20:00',
          shipping: 'Envíos a todo el país por correo y moto en CABA.',
          warranty: 'Garantía oficial del fabricante.',
          payments: 'Transferencia, Mercado Pago y tarjetas.',
        },
      },
    );

    const [[storeRow]] = await seq.query(`SELECT id FROM stores WHERE slug = 'techstore' LIMIT 1;`);

    // 4) Backfill: todos los productos existentes se liga a TechStore.
    await seq.query(
      `UPDATE products SET store_id = :storeId, updated_at = NOW() WHERE store_id IS NULL;`,
      { replacements: { storeId: storeRow.id } },
    );

    // 5) Super admin placeholder (quien aprueba tiendas nuevas).
    await createUserIfMissing(seq, {
      name: 'Super Admin',
      email: 'superadmin@techstore.com',
      role: 'super_admin',
    });
  },

  async down(queryInterface) {
    const seq = queryInterface.sequelize;

    const [[storeRow]] = await seq.query(`SELECT id FROM stores WHERE slug = 'techstore' LIMIT 1;`);
    if (storeRow) {
      await seq.query('UPDATE products SET store_id = NULL WHERE store_id = :storeId;', {
        replacements: { storeId: storeRow.id },
      });
      await seq.query('DELETE FROM stores WHERE id = :storeId;', {
        replacements: { storeId: storeRow.id },
      });
    }

    await seq.query(
      `DELETE FROM users WHERE email IN ('admin@techstore.com', 'superadmin@techstore.com');`,
    );
  },
};
