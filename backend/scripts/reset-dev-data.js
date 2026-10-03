/**
 * Reinicio manual de los DATOS DE NEGOCIO de la base de DESARROLLO.
 *
 * NO es parte de la suite automatizada ni se ejecuta solo: hay que invocarlo a mano.
 *
 *   Dry-run (muestra el plan y los conteos actuales, no borra nada):
 *     node scripts/reset-dev-data.js
 *
 *   Ejecución real (borra todo y crea el super_admin):
 *     node scripts/reset-dev-data.js --confirm
 *
 * Qué borra: order_items, orders, reviews, favorites, price_history, audit_logs,
 * plan_change_requests, store_applications, products, stores, users.
 * Qué NO toca: categories, plan_tiers (catálogos de referencia), SequelizeMeta,
 * migraciones ni esquema.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { QueryTypes } from 'sequelize';
import sequelize from '../src/config/database.js';
import User from '../src/models/user.model.js';

const EXPECTED_DEV_DB = 'techstore';
const SALT_ROUNDS = 10;
const SUPER_ADMIN = {
  name: 'Super Admin',
  email: 'superadmin@techstore.com',
  password: 'superadmin*#',
  role: 'super_admin',
};

const BUSINESS_TABLES = [
  'order_items',
  'orders',
  'reviews',
  'favorites',
  'price_history',
  'audit_logs',
  'plan_change_requests',
  'store_applications',
  'products',
  'stores',
  'users',
];

const REFERENCE_TABLES = ['categories', 'plan_tiers'];

const CONFIRM = process.argv.includes('--confirm');

// --- Guardas: nunca contra test ni producción ---
function assertSafeTarget() {
  const name = process.env.DB_NAME ?? '';
  if (!name) {
    throw new Error(
      'DB_NAME no está definido. Corré el script desde backend/ con el .env cargado.',
    );
  }
  if (/test|prod|staging|qa/i.test(name)) {
    throw new Error(
      `ABORTADO: DB_NAME="${name}" parece una base de test/producción. Este script solo corre contra "${EXPECTED_DEV_DB}".`,
    );
  }
  if (name !== EXPECTED_DEV_DB) {
    throw new Error(
      `ABORTADO: este script solo corre contra la BD de desarrollo "${EXPECTED_DEV_DB}" (DB_NAME="${name}").`,
    );
  }
  return name;
}

async function listTables() {
  const rows = await sequelize.query(
    `SELECT c.relname AS table_name
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname;`,
    { type: QueryTypes.SELECT },
  );
  return rows.map((row) => row.table_name);
}

async function scalar(sql) {
  const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
  const row = rows[0];
  if (row === undefined) return 0;
  return Array.isArray(row) ? row[0] : Object.values(row)[0];
}

async function countAll(tables, existing) {
  const counts = {};
  for (const table of tables) {
    if (!existing.includes(table)) {
      counts[table] = { count: 0, exists: false };
      continue;
    }
    counts[table] = {
      count: Number(await scalar(`SELECT COUNT(*)::int FROM "${table}";`)),
      exists: true,
    };
  }
  return counts;
}

function printCounts(title, counts) {
  console.log(`\n${title}`);
  for (const [table, info] of Object.entries(counts)) {
    const label = info.exists
      ? String(info.count)
      : `${info.count} (la tabla no existe en el esquema)`;
    console.log(`  ${table.padEnd(22)} ${label}`);
  }
}

async function main() {
  const database = assertSafeTarget();
  const existing = await listTables();
  const missing = BUSINESS_TABLES.filter((table) => !existing.includes(table));

  console.log(`Base de datos objetivo: ${database} (host ${sequelize.config.host})`);
  console.log(`Tablas de negocio a limpiar: ${BUSINESS_TABLES.join(', ')}`);
  console.log(`Catálogos de referencia (intactos): ${REFERENCE_TABLES.join(', ')}`);
  if (missing.length > 0) {
    console.log(
      `Aviso: no existen en el esquema: ${missing.join(', ')} (no hay nada que borrar ahí)`,
    );
  }

  printCounts('Conteos ANTES:', await countAll(BUSINESS_TABLES, existing));
  printCounts('Catálogos de referencia ANTES:', await countAll(REFERENCE_TABLES, existing));

  if (!CONFIRM) {
    console.log('\nDry-run: no se borró nada. Corré con --confirm para ejecutar el reinicio.');
    return;
  }

  const targetTables = BUSINESS_TABLES.filter((table) => existing.includes(table));
  const quoted = targetTables.map((table) => `"${table}"`).join(', ');
  console.log(`\nEjecutando: TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);

  await sequelize.transaction(async (t) => {
    await sequelize.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`, { transaction: t });

    const passwordHash = await bcrypt.hash(SUPER_ADMIN.password, SALT_ROUNDS);
    await User.create(
      { name: SUPER_ADMIN.name, email: SUPER_ADMIN.email, passwordHash, role: SUPER_ADMIN.role },
      { transaction: t },
    );
  });
  console.log('TRUNCATE ejecutado y super_admin creado, todo dentro de una sola transacción.');

  const after = await countAll(BUSINESS_TABLES, existing);
  const referenceAfter = await countAll(REFERENCE_TABLES, existing);
  printCounts('Conteos DESPUÉS:', after);
  printCounts('Catálogos de referencia DESPUÉS:', referenceAfter);

  const user = await User.findOne({ where: { email: SUPER_ADMIN.email } });
  const totalUsers = after.users.count;
  const passwordOk = await bcrypt.compare(SUPER_ADMIN.password, user.passwordHash);
  console.log('\nUsuario creado:');
  console.log(`  id=${user.id} name="${user.name}" email=${user.email} role=${user.role}`);
  console.log(`  password verifica contra el hash: ${passwordOk}`);
  console.log(`  users totales: ${totalUsers}`);

  const notEmpty = Object.entries(after).filter(
    ([table, info]) => table !== 'users' && info.count !== 0,
  );
  if (notEmpty.length > 0) {
    throw new Error(
      `Verificación fallida: tablas de negocio con filas: ${JSON.stringify(notEmpty)}`,
    );
  }
  if (totalUsers !== 1) {
    throw new Error(`Verificación fallida: users debería tener 1 fila y tiene ${totalUsers}.`);
  }
  if (!passwordOk) {
    throw new Error('Verificación fallida: el hash no coincide con la contraseña indicada.');
  }
  for (const table of REFERENCE_TABLES) {
    if (referenceAfter[table].exists && referenceAfter[table].count === 0) {
      throw new Error(`Verificación fallida: el catálogo de referencia ${table} quedó vacío.`);
    }
  }
  console.log(
    '\nOK  verificado: datos de negocio en 0, exactamente 1 usuario (super_admin) y catálogos intactos.',
  );
}

main()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error(`\n${error.message}`);
    await sequelize.close();
    process.exit(1);
  });
