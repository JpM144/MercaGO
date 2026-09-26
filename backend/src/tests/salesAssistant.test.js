import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';
import { __setClientFactoryForTests } from '../controllers/salesAssistant.controller.js';

let storeAdminOne;
let storeAdminTwo;
let pendingAdmin;
let storeOne;
let storeTwo;
let storePending;
let customer;
let iphone;
let cableOne;
let cableTwo;
let audifonos;
let iphonePro;

async function seedCatalog() {
  const passwordHash = await bcrypt.hash('secret123', 10);

  storeAdminOne = await db.User.create(
    { name: 'Dueño Uno', email: 'sa-uno@techstore.com', passwordHash, role: 'store_admin' },
    { returning: true },
  );
  storeAdminTwo = await db.User.create(
    { name: 'Dueño Dos', email: 'sa-dos@techstore.com', passwordHash, role: 'store_admin' },
    { returning: true },
  );
  pendingAdmin = await db.User.create(
    { name: 'Dueño Pendiente', email: 'sa-pendiente@techstore.com', passwordHash, role: 'store_admin' },
    { returning: true },
  );
  customer = await db.User.create(
    { name: 'Cliente Vinculado', email: 'cliente-vinculado@techstore.com', passwordHash, role: 'customer' },
    { returning: true },
  );

  storeOne = await db.Store.create(
    {
      name: 'Tienda Uno',
      slug: 'tienda-uno',
      whatsappNumber: '+541111111111',
      ownerUserId: storeAdminOne.id,
      status: 'approved',
    },
    { returning: true },
  );
  storeTwo = await db.Store.create(
    {
      name: 'Tienda Dos',
      slug: 'tienda-dos',
      whatsappNumber: '+542222222222',
      ownerUserId: storeAdminTwo.id,
      status: 'approved',
    },
    { returning: true },
  );
  storePending = await db.Store.create(
    {
      name: 'Tienda Pendiente',
      slug: 'tienda-pendiente',
      whatsappNumber: '+543333333333',
      ownerUserId: pendingAdmin.id,
      status: 'pending',
    },
    { returning: true },
  );

  const categories = await db.Category.bulkCreate(
    [
      { name: 'Celulares', slug: 'celulares' },
      { name: 'Accesorios', slug: 'accesorios' },
    ],
    { returning: true },
  );
  const [celulares, accesorios] = categories;

  [iphone, cableOne, cableTwo, audifonos] = await db.Product.bulkCreate(
    [
      { name: 'iPhone 15', slug: 'iphone-15', price: 1000, stock: 5, categoryId: celulares.id, storeId: storeOne.id },
      { name: 'Cable Tipo C', slug: 'cable-tipo-c', price: 15, stock: 10, categoryId: accesorios.id, storeId: storeOne.id },
      { name: 'Cable Tipo C', slug: 'cable-tipo-c-2', price: 18, stock: 7, categoryId: accesorios.id, storeId: storeOne.id },
      { name: 'Audifonos', slug: 'audifonos', price: 80, stock: 2, categoryId: accesorios.id, storeId: storeOne.id },
    ],
    { returning: true },
  );
  [iphonePro] = await db.Product.bulkCreate(
    [{ name: 'iPhone 15 Pro', slug: 'iphone-15-pro', price: 1400, stock: 4, categoryId: celulares.id, storeId: storeTwo.id }],
    { returning: true },
  );
}

async function tokenFor(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return res.body.token;
}

function toolCallMessage(name, args) {
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } },
          ],
        },
      },
    ],
  };
}

function finalMessage(content) {
  return { choices: [{ message: { role: 'assistant', content, tool_calls: null } }] };
}

function scriptClient(script) {
  const queue = [...script];
  const wrapped = async () => {
    wrapped.calls += 1;
    return queue.shift() ?? finalMessage('No confirmé nada.');
  };
  wrapped.calls = 0;
  __setClientFactoryForTests(() => ({ chat: { completions: { create: wrapped } } }));
  return wrapped;
}

async function chat(token, content) {
  const res = await request(app)
    .post('/api/store-admin/sales-assistant/chat')
    .set('Authorization', `Bearer ${token}`)
    .send({ messages: [{ role: 'user', content }] });
  if (res.status >= 500) {
    console.log('CHAT 500:', JSON.stringify(res.body));
  }
  return res;
}

async function orderCount() {
  return db.Order.count();
}

async function stockOf(product) {
  const fresh = await db.Product.findByPk(product.id);
  return fresh.stock;
}

beforeEach(async () => {
  await db.sequelize.query('TRUNCATE TABLE categories, stores, users CASCADE;');
  await seedCatalog();
  __setClientFactoryForTests(null);
});

afterAll(async () => {
  await db.sequelize.close();
});

test('venta simple exitosa: registra pedido confirmed, descuenta stock y vincula el contacto con un usuario existente', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  const create = scriptClient([
    toolCallMessage('register_sale', {
      items: [
        { product_name_or_id: 'iPhone 15', quantity: 2 },
        { product_name_or_id: cableOne.id, quantity: 1 },
      ],
      customer_name: 'Juan Perez',
      customer_contact: 'cliente-vinculado@techstore.com',
    }),
    finalMessage('Listo, registré la venta.'),
  ]);

  const res = await chat(token, 'Vendí 2 iphone 15 y 1 cable de la tienda a Juan, su email es cliente-vinculado@techstore.com');

  expect(res.status).toBe(200);
  expect(res.body.reply).toBe('Listo, registré la venta.');
  expect(res.body.order).not.toBeNull();
  expect(res.body.order.status).toBe('confirmed');
  expect(res.body.order.total).toBe(2015);
  expect(res.body.order.customerName).toBe('Juan Perez');
  expect(res.body.order.customerContact).toBe('cliente-vinculado@techstore.com');
  expect(res.body.order.userId).toBe(customer.id);
  expect(res.body.order.items).toHaveLength(2);
  expect(create.calls).toBe(2);

  expect(await orderCount()).toBe(1);
  expect(await stockOf(iphone)).toBe(3);
  expect(await stockOf(cableOne)).toBe(9);

  const stored = await db.Order.findOne({
    where: { id: res.body.order.id },
    include: [{ model: db.OrderItem, as: 'items' }],
  });
  expect(stored.status).toBe('confirmed');
  expect(stored.userId).toBe(customer.id);
  expect(stored.customerName).toBe('Juan Perez');
});

test('contacto sin cuenta existente: guarda datos sueltos con user_id null', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  scriptClient([
    toolCallMessage('register_sale', {
      items: [{ product_name_or_id: 'Audifonos', quantity: 1 }],
      customer_name: 'Maria Lopez',
      customer_contact: 'maria@ejemplo.com',
    }),
    finalMessage('Pedido creado.'),
  ]);

  const res = await chat(token, 'Vendi unos audifonos a Maria Lopez, contacto maria@ejemplo.com');

  expect(res.status).toBe(200);
  expect(res.body.order.userId).toBeNull();
  expect(res.body.order.customerName).toBe('Maria Lopez');
  expect(res.body.order.customerContact).toBe('maria@ejemplo.com');
  expect(await stockOf(audifonos)).toBe(1);
});

test('producto inexistente y producto ambiguo no ejecutan la venta', async () => {
  const token = await tokenFor('sa-uno@techstore.com');

  const create = scriptClient([
    toolCallMessage('register_sale', {
      items: [{ product_name_or_id: 'Producto Inexistente', quantity: 1 }],
    }),
    finalMessage('No encuentro "Producto Inexistente" en tu catalogo.'),
  ]);
  const resInexistente = await chat(token, 'Vendi un Producto Inexistente');
  expect(resInexistente.status).toBe(200);
  expect(resInexistente.body.order).toBeNull();
  expect(create.calls).toBe(2);

  scriptClient([
    toolCallMessage('register_sale', {
      items: [{ product_name_or_id: 'Cable Tipo C', quantity: 1 }],
    }),
    finalMessage('Cual de los dos cables?'),
  ]);
  const resAmbiguo = await chat(token, 'Vendi un Cable Tipo C');
  expect(resAmbiguo.status).toBe(200);
  expect(resAmbiguo.body.order).toBeNull();

  expect(await orderCount()).toBe(0);
  expect(await stockOf(cableOne)).toBe(10);
  expect(await stockOf(cableTwo)).toBe(7);
});

test('stock insuficiente no ejecuta la venta ni descuenta stock', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  scriptClient([
    toolCallMessage('register_sale', {
      items: [{ product_name_or_id: 'Audifonos', quantity: 99 }],
    }),
    finalMessage('No hay stock suficiente.'),
  ]);

  const res = await chat(token, 'Vendi 99 audifonos');

  expect(res.status).toBe(200);
  expect(res.body.order).toBeNull();
  expect(await orderCount()).toBe(0);
  expect(await stockOf(audifonos)).toBe(2);
});

test('un store_admin no puede vender productos de otra tienda', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  scriptClient([
    toolCallMessage('register_sale', {
      items: [
        { product_name_or_id: 'iPhone 15', quantity: 1 },
        { product_name_or_id: iphonePro.id, quantity: 1 },
      ],
    }),
    finalMessage('Ese producto no esta en tu tienda.'),
  ]);

  const res = await chat(token, 'Vendi un iphone 15 y un iphone 15 pro');

  expect(res.status).toBe(200);
  expect(res.body.order).toBeNull();
  expect(await orderCount()).toBe(0);
  expect(await stockOf(iphone)).toBe(5);
  expect(await stockOf(iphonePro)).toBe(4);
});

test('requiere store_admin con tienda aprobada (403 en otros casos)', async () => {
  expect(storePending.status).toBe('pending');
  const pendingToken = await tokenFor('sa-pendiente@techstore.com');
  const customerToken = await tokenFor('cliente-vinculado@techstore.com');
  const noAuth = await request(app)
    .post('/api/store-admin/sales-assistant/chat')
    .send({ messages: [{ role: 'user', content: 'hola' }] });
  expect(noAuth.status).toBe(401);

  const pendingRes = await chat(pendingToken, 'hola');
  expect(pendingRes.status).toBe(403);

  const customerRes = await chat(customerToken, 'hola');
  expect(customerRes.status).toBe(403);

  expect(await orderCount()).toBe(0);
});