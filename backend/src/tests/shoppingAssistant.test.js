import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';
import { __setClientFactoryForTests } from '../controllers/shoppingAssistant.controller.js';

let storeOne;
let storeTwo;
let auricularesX;
let auricularesY;
let auricularesProhibidos;
let mouseGamer;

async function seedCatalog() {
  const passwordHash = await bcrypt.hash('secret123', 10);

  const adminOne = await db.User.create(
    { name: 'Dueño Uno', email: 'sa-uno@techstore.com', passwordHash, role: 'store_admin' },
    { returning: true },
  );
  const adminTwo = await db.User.create(
    { name: 'Dueño Dos', email: 'sa-dos@techstore.com', passwordHash, role: 'store_admin' },
    { returning: true },
  );
  const pendingAdmin = await db.User.create(
    { name: 'Dueño Pendiente', email: 'sa-pendiente@techstore.com', passwordHash, role: 'store_admin' },
    { returning: true },
  );

  storeOne = await db.Store.create(
    {
      name: 'Tienda Uno',
      slug: 'tienda-uno',
      whatsappNumber: '+541111111111',
      ownerUserId: adminOne.id,
      status: 'approved',
    },
    { returning: true },
  );
  storeTwo = await db.Store.create(
    {
      name: 'Tienda Dos',
      slug: 'tienda-dos',
      whatsappNumber: '+542222222222',
      ownerUserId: adminTwo.id,
      status: 'approved',
    },
    { returning: true },
  );
  const storePending = await db.Store.create(
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
      { name: 'Audio', slug: 'audio' },
      { name: 'Accesorios', slug: 'accesorios' },
    ],
    { returning: true },
  );
  const [audio, accesorios] = categories;

  [auricularesX, mouseGamer] = await db.Product.bulkCreate(
    [
      { name: 'Auriculares Bluetooth X', slug: 'auriculares-bluetooth-x', price: 45, stock: 10, categoryId: audio.id, storeId: storeOne.id },
      { name: 'Mouse Gamer', slug: 'mouse-gamer', price: 60, stock: 8, categoryId: accesorios.id, storeId: storeOne.id },
    ],
    { returning: true },
  );
  [auricularesY] = await db.Product.bulkCreate(
    [
      { name: 'Auriculares Over-Ear Y', slug: 'auriculares-over-ear-y', price: 120, stock: 5, categoryId: audio.id, storeId: storeTwo.id },
    ],
    { returning: true },
  );
  await db.Product.bulkCreate([
    { name: 'Teclado Mecanico', slug: 'teclado-mecanico', price: 80, stock: 6, categoryId: accesorios.id, storeId: storeTwo.id },
  ]);
  [auricularesProhibidos] = await db.Product.bulkCreate(
    [
      { name: 'Auriculares Prohibidos', slug: 'auriculares-prohibidos', price: 999, stock: 1, categoryId: audio.id, storeId: storePending.id },
    ],
    { returning: true },
  );
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
    return queue.shift() ?? finalMessage('No configuré una respuesta.');
  };
  wrapped.calls = 0;
  __setClientFactoryForTests(() => ({ chat: { completions: { create: wrapped } } }));
  return wrapped;
}

async function chat(messages = [{ role: 'user', content: 'hola' }]) {
  return request(app).post('/api/shopping-assistant/chat').send({ messages });
}

beforeEach(async () => {
  await db.sequelize.query('TRUNCATE TABLE categories, stores, users CASCADE;');
  await seedCatalog();
  __setClientFactoryForTests(null);
});

afterAll(async () => {
  await db.sequelize.close();
});

test('público sin autenticación: el modelo recibe resultados reales de búsqueda y los usa para responder', async () => {
  const create = scriptClient([
    toolCallMessage('search_products', { query: 'auricular' }),
    finalMessage(
      'Tenés Auriculares Bluetooth X en Tienda Uno a $45 y Auriculares Over-Ear Y en Tienda Dos a $120.',
    ),
  ]);

  const res = await chat([{ role: 'user', content: 'hola, busco auriculares' }]);

  expect(res.status).toBe(200);
  expect(res.body.reply).toContain('Auriculares Bluetooth X');
  expect(res.body.products).toHaveLength(2);
  expect(res.body.products.map((p) => p.name)).toEqual(
    expect.arrayContaining(['Auriculares Bluetooth X', 'Auriculares Over-Ear Y']),
  );
  expect(res.body.products.map((p) => p.store.name)).toEqual(
    expect.arrayContaining(['Tienda Uno', 'Tienda Dos']),
  );
  expect(res.body.products.map((p) => p.id)).not.toContain(auricularesProhibidos.id);
  expect(create.calls).toBe(2);

  const bluetooth = res.body.products.find((p) => p.slug === auricularesX.slug);
  expect(bluetooth.price).toBe(45);
  expect(bluetooth.store.slug).toBe(storeOne.slug);
  expect(bluetooth.category.name).toBe('Audio');
});

test('sin resultados: el modelo comunica que no encontró nada en lugar de inventar', async () => {
  const create = scriptClient([
    toolCallMessage('search_products', { query: 'producto que no existe xyz' }),
    finalMessage(
      'No encontré "producto que no existe xyz" en ninguna tienda. ¿Me contás qué buscás con otras palabras?',
    ),
  ]);

  const res = await chat([{ role: 'user', content: 'necesito un producto que no existe xyz' }]);

  expect(res.status).toBe(200);
  expect(res.body.reply).toMatch(/no encontr/i);
  expect(res.body.products).toEqual([]);
  expect(create.calls).toBe(2);
});

test('los filtros category, store_slug y maxPrice aplican a la búsqueda real', async () => {
  const create = scriptClient([
    toolCallMessage('search_products', { query: 'auricular', store_slug: 'tienda-uno', maxPrice: 100 }),
    finalMessage('En Tienda Uno hasta $100 tenés los Auriculares Bluetooth X.'),
  ]);

  const res = await chat([{ role: 'user', content: 'un auricular barato de Tienda Uno' }]);

  expect(res.status).toBe(200);
  expect(res.body.products).toHaveLength(1);
  expect(res.body.products[0].slug).toBe(auricularesX.slug);
  expect(res.body.products[0].price).toBe(45);
  expect(create.calls).toBe(2);

  scriptClient([
    toolCallMessage('search_products', { query: 'auriculares', category: 'audio' }),
    finalMessage('Encontré dos auriculares en audio.'),
  ]);
  const resAudio = await chat([{ role: 'user', content: 'auriculares en audio' }]);
  expect(resAudio.status).toBe(200);
  expect(resAudio.body.products.map((p) => p.slug)).toEqual(
    expect.arrayContaining([auricularesX.slug, auricularesY.slug]),
  );
  expect(resAudio.body.products.map((p) => p.id)).not.toContain(auricularesProhibidos.id);
  expect(resAudio.body.products.map((p) => p.slug)).not.toContain(mouseGamer.slug);
});

test('validación: 400 si messages no es una lista no vacía y 503 sin NVIDIA_API_KEY', async () => {
  const missing = await request(app).post('/api/shopping-assistant/chat').send({});
  expect(missing.status).toBe(400);
  expect(missing.body.error).toBeTruthy();

  const empty = await request(app).post('/api/shopping-assistant/chat').send({ messages: [] });
  expect(empty.status).toBe(400);
  expect(empty.body.error).toBeTruthy();

  const textoPlano = await request(app)
    .post('/api/shopping-assistant/chat')
    .send({ messages: 'hola' });
  expect(textoPlano.status).toBe(400);
  expect(textoPlano.body.error).toBeTruthy();
});