import request from 'supertest';
import app from '../app.js';
import db from '../models/index.js';
import { __setClientFactoryForTests } from '../controllers/storeApplicationAssistant.controller.js';

function finalMessage(content) {
  return { choices: [{ message: { role: 'assistant', content, tool_calls: null } }] };
}

function scriptClient(script) {
  const queue = [...script];
  const wrapped = async (args) => {
    wrapped.calls += 1;
    wrapped.lastArgs = args;
    return queue.shift() ?? finalMessage('No configuré una respuesta.');
  };
  wrapped.calls = 0;
  wrapped.lastArgs = null;
  __setClientFactoryForTests(() => ({ chat: { completions: { create: wrapped } } }));
  return wrapped;
}

async function chat(messages = [{ role: 'user', content: 'vendo fundas de celular' }]) {
  return request(app).post('/api/store-application-assistant/chat').send({ messages });
}

beforeEach(async () => {
  await db.sequelize.query('TRUNCATE TABLE categories, stores, users CASCADE;');
  const owner = await db.User.create({
    name: 'Dueño',
    email: 'owner@techstore.com',
    passwordHash: 'x',
    role: 'store_admin',
  });
  const store = await db.Store.create({
    name: 'Tienda',
    slug: 'tienda',
    whatsappNumber: '+541111111111',
    ownerUserId: owner.id,
    status: 'approved',
  });
  await db.Category.bulkCreate([
    { name: 'Audio', slug: 'audio', storeId: store.id },
    { name: 'Accesorios para celular', slug: 'accesorios-para-celular', storeId: store.id },
    { name: 'Celulares', slug: 'celulares', storeId: store.id },
  ]);
});

afterAll(async () => {
  await db.sequelize.close();
});

test('público + formato estructurado: parsea suggestedDescription y suggestedCategory', async () => {
  const create = scriptClient([
    finalMessage(
      '{"suggestedDescription":"Tienda dedicada a la venta de forros y accesorios para celulares.","suggestedCategory":"Accesorios para celular"}',
    ),
  ]);

  const res = await chat([{ role: 'user', content: 'vendo fundas y accesorios para celular' }]);

  expect(res.status).toBe(200);
  expect(res.body.suggestedDescription).toBe(
    'Tienda dedicada a la venta de forros y accesorios para celulares.',
  );
  expect(res.body.suggestedCategory).toBe('Accesorios para celular');
  expect(res.body.reply).toContain('descripción propuesta');
  expect(create.calls).toBe(1);
  expect(create.lastArgs.model).toBeTruthy();
  expect(create.lastArgs.tools).toBeUndefined();
});

test('no requiere token: el endpoint es público (200 sin Authorization)', async () => {
  scriptClient([finalMessage('{"suggestedDescription":"Tienda dedicada a la música y el audio de alta fidelidad.","suggestedCategory":"Audio"}')]);
  const res = await request(app).post('/api/store-application-assistant/chat').send({
    messages: [{ role: 'user', content: 'vivo de la música' }],
  });
  expect(res.status).toBe(200);
  expect(res.body.suggestedCategory).toBe('Audio');
});

test('tolera JSON dentro de bloque con texto adicional y conserva el historial de mensajes del usuario', async () => {
  const create = scriptClient([
    finalMessage(
      'Perfecto, acá va:\n```json\n{"suggestedDescription": "Vendemos parlantes y auriculares.", "suggestedCategory": "Audio"}\n```\nSaludos!',
    ),
  ]);

  const res = await chat([
    { role: 'user', content: 'buenas, mi tienda es de audio' },
    { role: 'assistant', content: 'Perfecto, ¿qué productos vendés?' },
    { role: 'user', content: 'parlantes y auriculares' },
  ]);

  expect(res.status).toBe(200);
  expect(res.body.suggestedDescription).toBe('Vendemos parlantes y auriculares.');
  expect(res.body.suggestedCategory).toBe('Audio');

  const userRoles = create.lastArgs.messages.filter((m) => m.role === 'user');
  expect(userRoles).toHaveLength(1);
  expect(userRoles[0].content).toContain('buenas, mi tienda es de audio');
  expect(userRoles[0].content).toContain('parlantes y auriculares');
  expect(userRoles[0].content).not.toContain('¿qué productos vendés?');
});

test('categoría inventada que no está en el catálogo se descarta (null) pero conserva la descripción', async () => {
  scriptClient([
    finalMessage('{"suggestedDescription":"Ropa y accesorios electrónicos.","suggestedCategory":"Moda"}'),
  ]);
  const res = await chat([{ role: 'user', content: 'mi tienda es de ropa y gadgets' }]);
  expect(res.status).toBe(200);
  expect(res.body.suggestedDescription).toBe('Ropa y accesorios electrónicos.');
  expect(res.body.suggestedCategory).toBeNull();
});

test('texto libre sin JSON: devuelve reply y sugerencias en null sin romper', async () => {
  scriptClient([finalMessage('No estoy seguro de qué categoría encaja, contame más.')]);
  const res = await chat([{ role: 'user', content: 'hago accesorios' }]);
  expect(res.status).toBe(200);
  expect(res.body.reply).toBe('No estoy seguro de qué categoría encaja, contame más.');
  expect(res.body.suggestedDescription).toBeNull();
  expect(res.body.suggestedCategory).toBeNull();
});

test('JSON malformado no rompe y deja sugerencias en null', async () => {
  scriptClient([finalMessage('{"suggestedDescription": "desc rota", "suggestedCategory": }')]);
  const res = await chat([{ role: 'user', content: 'vendo cosas' }]);
  expect(res.status).toBe(200);
  expect(res.body.suggestedDescription).toBeNull();
  expect(res.body.suggestedCategory).toBeNull();
  expect(res.body.reply).toContain('desc rota');
});

test('acumula la información: con mensaje assistant en JSON digiere sugerencia previa + nuevo dato del usuario', async () => {
  const create = scriptClient([
    finalMessage(
      '{"suggestedDescription":"Tienda de fundas y accesorios para celulares. Operamos en Medellín. Además, realizamos envíos a todo el país.","suggestedCategory":"Accesorios para celular"}',
    ),
  ]);

  const res = await chat([
    { role: 'user', content: 'vendo fundas y accesorios para celular en Medellín' },
    {
      role: 'assistant',
      content:
        '{"suggestedDescription":"Tienda de fundas para celular en Medellín.","suggestedCategory":"Accesorios para celular"}',
    },
    { role: 'user', content: 'agregá que hacemos envíos a todo el país' },
  ]);

  expect(res.status).toBe(200);
  expect(res.body.suggestedDescription).toContain('Medellín');
  expect(res.body.suggestedDescription).toContain('envíos a todo el país');
  expect(res.body.suggestedCategory).toBe('Accesorios para celular');

  const userRoles = create.lastArgs.messages.filter((m) => m.role === 'user');
  expect(userRoles).toHaveLength(1);
  expect(userRoles[0].content).toContain('Sugerencia actual del asistente');
  expect(userRoles[0].content).toContain('Tienda de fundas para celular en Medellín.');
  expect(userRoles[0].content).toContain('vendo fundas y accesorios para celular en Medellín');
});

test('validación: 400 si messages no es lista no vacía', async () => {
  const missing = await request(app).post('/api/store-application-assistant/chat').send({});
  expect(missing.status).toBe(400);
  expect(missing.body.error).toBeTruthy();

  const empty = await request(app)
    .post('/api/store-application-assistant/chat')
    .send({ messages: [] });
  expect(empty.status).toBe(400);
  expect(empty.body.error).toBeTruthy();

  const textoPlano = await request(app)
    .post('/api/store-application-assistant/chat')
    .send({ messages: 'hola' });
  expect(textoPlano.status).toBe(400);
  expect(textoPlano.body.error).toBeTruthy();
});