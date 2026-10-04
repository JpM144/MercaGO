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
    {
      name: 'Dueño Pendiente',
      email: 'sa-pendiente@techstore.com',
      passwordHash,
      role: 'store_admin',
    },
    { returning: true },
  );
  customer = await db.User.create(
    {
      name: 'Cliente Vinculado',
      email: 'cliente-vinculado@techstore.com',
      passwordHash,
      role: 'customer',
    },
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
      { name: 'Celulares', slug: 'celulares', storeId: storeOne.id },
      { name: 'Accesorios', slug: 'accesorios', storeId: storeOne.id },
    ],
    { returning: true },
  );
  const [celulares, accesorios] = categories;

  [iphone, cableOne, cableTwo, audifonos] = await db.Product.bulkCreate(
    [
      {
        name: 'iPhone 15',
        slug: 'iphone-15',
        price: 1000,
        cost: 700,
        stock: 5,
        categoryId: celulares.id,
        storeId: storeOne.id,
      },
      {
        name: 'Cable Tipo C',
        slug: 'cable-tipo-c',
        price: 15,
        cost: 10,
        stock: 10,
        categoryId: accesorios.id,
        storeId: storeOne.id,
      },
      {
        name: 'Cable Tipo C',
        slug: 'cable-tipo-c-2',
        price: 18,
        stock: 7,
        categoryId: accesorios.id,
        storeId: storeOne.id,
      },
      {
        name: 'Audifonos',
        slug: 'audifonos',
        price: 80,
        cost: 50,
        stock: 2,
        categoryId: accesorios.id,
        storeId: storeOne.id,
      },
    ],
    { returning: true },
  );
  [iphonePro] = await db.Product.bulkCreate(
    [
      {
        name: 'iPhone 15 Pro',
        slug: 'iphone-15-pro',
        price: 1400,
        stock: 4,
        categoryId: celulares.id,
        storeId: storeTwo.id,
      },
    ],
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

let currentCreate = null;

function scriptClient(script) {
  const queue = [...script];
  const wrapped = async () => {
    wrapped.calls += 1;
    return queue.shift() ?? finalMessage('No confirmé nada.');
  };
  wrapped.calls = 0;
  __setClientFactoryForTests(() => ({ chat: { completions: { create: wrapped } } }));
  currentCreate = wrapped;
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

async function chatHistory(token, messages) {
  const res = await request(app)
    .post('/api/store-admin/sales-assistant/chat')
    .set('Authorization', `Bearer ${token}`)
    .send({ messages });
  if (res.status >= 500) {
    console.log('CHAT 500:', JSON.stringify(res.body));
  }
  return res;
}

const PROPOSAL =
  'Resumen de la venta: 2 x iPhone 15 (US$1.000 c/u) y 1 x Cable Tipo C (US$15). Total US$2.015. Cliente: Juan Perez (cliente-vinculado@techstore.com). ¿Confirmás que aplique el descuento de stock?';

async function proposeAndConfirm(token, originalMessage, confirmation = 'Sí, confirmo, dale') {
  const first = await chat(token, originalMessage);
  const afterFirst = {
    calls: currentCreate ? currentCreate.calls : 0,
    orders: await orderCount(),
    stockIphone: await stockOf(iphone),
    stockCableOne: await stockOf(cableOne),
    stockAudifonos: await stockOf(audifonos),
  };
  const second = await chatHistory(token, [
    { role: 'user', content: originalMessage },
    { role: 'assistant', content: first.body.reply },
    { role: 'user', content: confirmation },
  ]);
  return { first, afterFirst, second };
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

test('venta en dos turnos: el turno 1 propone sin tool call y el turno 2 con confirmación registra el pedido, descuenta stock y vincula el contacto', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  const create = scriptClient([
    finalMessage(PROPOSAL),
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

  const original =
    'Vendí 2 iphone 15 y 1 cable de la tienda a Juan, su email es cliente-vinculado@techstore.com';
  const { first, afterFirst, second: res } = await proposeAndConfirm(token, original);

  // Turno 1: propuesta en texto, sin ejecutar nada.
  expect(first.status).toBe(200);
  expect(first.body.order).toBeNull();
  expect(first.body.reply).toContain('¿Confirmás');
  expect(afterFirst.calls).toBe(1);
  expect(afterFirst.orders).toBe(0);
  expect(afterFirst.stockIphone).toBe(5);
  expect(afterFirst.stockCableOne).toBe(10);

  // Turno 2: confirmation explícita -> recién ahí se ejecuta.
  expect(res.status).toBe(200);
  expect(res.body.reply).toBe('Listo, registré la venta.');
  expect(res.body.order).not.toBeNull();
  expect(res.body.order.status).toBe('confirmed');
  expect(res.body.order.total).toBe(2015);
  expect(res.body.order.customerName).toBe('Juan Perez');
  expect(res.body.order.customerContact).toBe('cliente-vinculado@techstore.com');
  expect(res.body.order.userId).toBe(customer.id);
  expect(res.body.order.items).toHaveLength(2);
  expect(create.calls).toBe(3);

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

  const iphoneItem = stored.items.find((item) => item.productId === iphone.id);
  const cableItem = stored.items.find((item) => item.productId === cableOne.id);
  expect(Number(iphoneItem.unitPrice)).toBe(1000);
  expect(Number(iphoneItem.unitCost)).toBe(700);
  expect(Number(cableItem.unitPrice)).toBe(15);
  expect(Number(cableItem.unitCost)).toBe(10);
});

test('contacto sin cuenta existente: guarda datos sueltos con user_id null', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  scriptClient([
    finalMessage(
      'Resumen: 1 x Audifonos (US$80). Total US$80. Cliente: Maria Lopez (maria@ejemplo.com). ¿Confirmás que aplique el descuento de stock?',
    ),
    toolCallMessage('register_sale', {
      items: [{ product_name_or_id: 'Audifonos', quantity: 1 }],
      customer_name: 'Maria Lopez',
      customer_contact: 'maria@ejemplo.com',
    }),
    finalMessage('Pedido creado.'),
  ]);

  const {
    first,
    afterFirst,
    second: res,
  } = await proposeAndConfirm(
    token,
    'Vendi unos audifonos a Maria Lopez, contacto maria@ejemplo.com',
  );

  expect(first.body.order).toBeNull();
  expect(afterFirst.orders).toBe(0);
  expect(afterFirst.stockAudifonos).toBe(2);

  expect(res.status).toBe(200);
  expect(res.body.order.userId).toBeNull();
  expect(res.body.order.customerName).toBe('Maria Lopez');
  expect(res.body.order.customerContact).toBe('maria@ejemplo.com');
  expect(await stockOf(audifonos)).toBe(1);
});

test('turno 1 con información suficiente: responde con el resumen y la pregunta de confirmación, sin tool call y sin crear el pedido', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  const create = scriptClient([finalMessage(PROPOSAL)]);

  const res = await chat(token, 'Vendí 2 iphone 15 y 1 cable a Juan');

  expect(res.status).toBe(200);
  expect(res.body.reply).toBe(PROPOSAL);
  expect(res.body.reply).toContain('iPhone 15');
  expect(res.body.reply).toContain('¿Confirmás');
  expect(res.body.order).toBeNull();
  expect(create.calls).toBe(1);
  expect(await orderCount()).toBe(0);
  expect(await stockOf(iphone)).toBe(5);
  expect(await stockOf(cableOne)).toBe(10);
});

test('el modelo no puede saltarse la confirmación: si llama register_sale en el turno 1, el pedido NO se crea', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  const create = scriptClient([
    toolCallMessage('register_sale', { items: [{ product_name_or_id: 'iPhone 15', quantity: 1 }] }),
    finalMessage('Antes necesito tu confirmación: ¿Confirmás que aplique el descuento de stock?'),
  ]);

  const res = await chat(token, 'Vendí un iphone 15');

  expect(res.status).toBe(200);
  expect(res.body.order).toBeNull();
  expect(res.body.reply).toContain('confirmación');
  expect(create.calls).toBe(2);
  expect(await orderCount()).toBe(0);
  expect(await stockOf(iphone)).toBe(5);
});

test('negación del store_admin: no ejecuta nada aunque el modelo intente llamar la herramienta', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  const create = scriptClient([
    finalMessage(PROPOSAL),
    toolCallMessage('register_sale', {
      items: [{ product_name_or_id: 'iPhone 15', quantity: 2 }],
      customer_name: 'Juan Perez',
    }),
    finalMessage('Entendido, no registro nada.'),
  ]);

  const original = 'Vendí 2 iphone 15 a Juan';
  const {
    first,
    afterFirst,
    second: res,
  } = await proposeAndConfirm(token, original, 'No, cancelalo, fue un error');

  expect(first.body.order).toBeNull();
  expect(afterFirst.orders).toBe(0);
  expect(res.status).toBe(200);
  expect(res.body.order).toBeNull();
  expect(create.calls).toBe(3);
  expect(await orderCount()).toBe(0);
  expect(await stockOf(iphone)).toBe(5);
});

test('corrección del store_admin ("sí, pero...") no cuenta como confirmación y no ejecuta', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  const create = scriptClient([
    finalMessage(PROPOSAL),
    toolCallMessage('register_sale', {
      items: [{ product_name_or_id: 'iPhone 15', quantity: 2 }],
    }),
    finalMessage('Corregime la cantidad y lo registramos.'),
  ]);

  const original = 'Vendí 2 iphone 15';
  const {
    first,
    afterFirst,
    second: res,
  } = await proposeAndConfirm(token, original, 'Sí, pero eran 3 iphone 15 en total');

  expect(first.body.order).toBeNull();
  expect(afterFirst.orders).toBe(0);
  expect(res.body.order).toBeNull();
  expect(create.calls).toBe(3);
  expect(await orderCount()).toBe(0);
  expect(await stockOf(iphone)).toBe(5);
});

test('sin propuesta previa en el historial no hay confirmación posible, aunque el último mensaje sea afirmativo', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  scriptClient([
    toolCallMessage('register_sale', { items: [{ product_name_or_id: 'iPhone 15', quantity: 1 }] }),
    finalMessage('Primero te resumo y me confirmás.'),
  ]);

  const res = await chat(token, 'dale, confirmo, son 2 iphone 15');

  expect(res.status).toBe(200);
  expect(res.body.order).toBeNull();
  expect(await orderCount()).toBe(0);
  expect(await stockOf(iphone)).toBe(5);
});

test('no duplica la venta si el modelo insiste con la herramienta en el mismo turno confirmado', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  scriptClient([
    finalMessage(PROPOSAL),
    toolCallMessage('register_sale', { items: [{ product_name_or_id: 'iPhone 15', quantity: 1 }] }),
    toolCallMessage('register_sale', { items: [{ product_name_or_id: 'iPhone 15', quantity: 1 }] }),
    finalMessage('Listo, registré la venta.'),
  ]);

  const original = 'Vendí un iphone 15';
  const { second: res } = await proposeAndConfirm(token, original);

  expect(res.status).toBe(200);
  expect(res.body.order).not.toBeNull();
  expect(await orderCount()).toBe(1);
  expect(await stockOf(iphone)).toBe(4);
});

test('producto inexistente y producto ambiguo no ejecutan la venta', async () => {
  const token = await tokenFor('sa-uno@techstore.com');

  const create = scriptClient([
    finalMessage('¿Confirmás que registre 1 x Producto Inexistente?'),
    toolCallMessage('register_sale', {
      items: [{ product_name_or_id: 'Producto Inexistente', quantity: 1 }],
    }),
    finalMessage('No encuentro "Producto Inexistente" en tu catalogo.'),
  ]);
  const { second: resInexistente } = await proposeAndConfirm(
    token,
    'Vendi un Producto Inexistente',
  );
  expect(resInexistente.status).toBe(200);
  expect(resInexistente.body.order).toBeNull();
  expect(create.calls).toBe(3);

  scriptClient([
    finalMessage('¿Confirmás que registre 1 x Cable Tipo C?'),
    toolCallMessage('register_sale', {
      items: [{ product_name_or_id: 'Cable Tipo C', quantity: 1 }],
    }),
    finalMessage('Cual de los dos cables?'),
  ]);
  const { second: resAmbiguo } = await proposeAndConfirm(token, 'Vendi un Cable Tipo C');
  expect(resAmbiguo.status).toBe(200);
  expect(resAmbiguo.body.order).toBeNull();

  expect(await orderCount()).toBe(0);
  expect(await stockOf(cableOne)).toBe(10);
  expect(await stockOf(cableTwo)).toBe(7);
});

test('stock insuficiente no ejecuta la venta ni descuenta stock', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  scriptClient([
    finalMessage('¿Confirmás que registre 99 x Audifonos?'),
    toolCallMessage('register_sale', {
      items: [{ product_name_or_id: 'Audifonos', quantity: 99 }],
    }),
    finalMessage('No hay stock suficiente.'),
  ]);

  const { second: res } = await proposeAndConfirm(token, 'Vendi 99 audifonos');

  expect(res.status).toBe(200);
  expect(res.body.order).toBeNull();
  expect(await orderCount()).toBe(0);
  expect(await stockOf(audifonos)).toBe(2);
});

test('un store_admin no puede vender productos de otra tienda', async () => {
  const token = await tokenFor('sa-uno@techstore.com');
  scriptClient([
    finalMessage('¿Confirmás que registre 1 x iPhone 15 y 1 x iPhone 15 Pro?'),
    toolCallMessage('register_sale', {
      items: [
        { product_name_or_id: 'iPhone 15', quantity: 1 },
        { product_name_or_id: iphonePro.id, quantity: 1 },
      ],
    }),
    finalMessage('Ese producto no esta en tu tienda.'),
  ]);

  const { second: res } = await proposeAndConfirm(token, 'Vendi un iphone 15 y un iphone 15 pro');

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
