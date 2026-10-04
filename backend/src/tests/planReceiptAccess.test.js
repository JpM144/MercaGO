import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';
import { PLAN_RECEIPTS_DIR, REVIEW_PHOTOS_DIR } from '../middleware/upload.middleware.js';

const DAY = 24 * 60 * 60 * 1000;

// PNG 1x1 transparente, suficiente para comprobar que el byte servido es el del disco.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const RECEIPT_FILENAME = 'test-receipt-acceso.png';
const REVIEW_FILENAME = 'test-review-acceso.png';

let targetTierId;

function writeFixture(dir, filename, contents) {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, contents);
  return filePath;
}

async function createUser(email, role) {
  return db.User.create({
    name: role,
    email,
    passwordHash: await bcrypt.hash('secret123', 10),
    role,
  });
}

async function loginToken(email) {
  const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return login.body.token;
}

async function createStoreWithRequest(ownerEmail, plan = {}) {
  const owner = await createUser(ownerEmail, 'store_admin');
  const store = await db.Store.create({
    name: `Tienda ${ownerEmail.split('@')[0]}`,
    slug: `tienda-${ownerEmail.split('@')[0]}`,
    whatsappNumber: '+5491100000000',
    ownerUserId: owner.id,
    status: 'approved',
    planStartedAt: new Date(Date.now() - DAY),
    planExpiresAt: new Date(Date.now() + 30 * DAY),
    planStatus: 'active',
    ...plan,
  });
  const changeRequest = await db.PlanChangeRequest.create({
    storeId: store.id,
    requestedTierId: targetTierId,
    requestedByUserId: owner.id,
    status: 'pending',
    receiptUrl: `/uploads/plan-receipts/${RECEIPT_FILENAME}`,
  });
  return { owner, store, changeRequest };
}

describe('Acceso a los comprobantes de cambio de plan', () => {
  beforeAll(() => {
    writeFixture(PLAN_RECEIPTS_DIR, RECEIPT_FILENAME, PNG_BYTES);
    writeFixture(REVIEW_PHOTOS_DIR, REVIEW_FILENAME, PNG_BYTES);
  });

  afterAll(async () => {
    await fs.promises.rm(path.join(PLAN_RECEIPTS_DIR, RECEIPT_FILENAME), { force: true });
    await fs.promises.rm(path.join(REVIEW_PHOTOS_DIR, REVIEW_FILENAME), { force: true });
    await db.sequelize.close();
  });

  beforeEach(async () => {
    await db.sequelize.query(
      'TRUNCATE TABLE plan_change_requests, categories, stores, users, plan_tiers CASCADE;',
    );
    [targetTierId] = (
      await db.PlanTier.bulkCreate([{ name: 'Objetivo', price: 100000, productLimit: 50 }], {
        returning: true,
      })
    ).map((tier) => tier.id);
  });

  test('el dueño de la solicitud ve su propio comprobante', async () => {
    const { owner, changeRequest } = await createStoreWithRequest(
      'dueno-propietario@techstore.com',
    );
    const token = await loginToken(owner.email);

    const res = await request(app)
      .get(`/api/store-admin/plan-change-requests/${changeRequest.id}/receipt`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(Buffer.from(res.body)).toEqual(PNG_BYTES);
  });

  test('un store_admin NO puede ver el comprobante de otra tienda', async () => {
    const { changeRequest } = await createStoreWithRequest('dueno-victima@techstore.com');
    const { owner: intruso } = await createStoreWithRequest('dueno-intruso@techstore.com');
    const token = await loginToken(intruso.email);

    const res = await request(app)
      .get(`/api/store-admin/plan-change-requests/${changeRequest.id}/receipt`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/otra tienda/i);
  });

  test('un customer no puede ver ningún comprobante', async () => {
    const { changeRequest } = await createStoreWithRequest('dueno-lectura@techstore.com');
    const cliente = await createUser('cliente-lector@techstore.com', 'customer');
    const token = await loginToken(cliente.email);

    const res = await request(app)
      .get(`/api/store-admin/plan-change-requests/${changeRequest.id}/receipt`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);

    const customerToken = (
      await request(app)
        .post('/api/auth/login')
        .send({ email: cliente.email, password: 'secret123' })
    ).body.token;

    const superRes = await request(app)
      .get(`/api/super-admin/plan-change-requests/${changeRequest.id}/receipt`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(superRes.status).toBe(403);
  });

  test('el super_admin puede ver el comprobante de cualquier tienda', async () => {
    const { changeRequest } = await createStoreWithRequest('dueno-supervisado@techstore.com');
    const superAdmin = await createUser('super-comprobante@techstore.com', 'super_admin');
    const token = await loginToken(superAdmin.email);

    const res = await request(app)
      .get(`/api/super-admin/plan-change-requests/${changeRequest.id}/receipt`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(Buffer.from(res.body)).toEqual(PNG_BYTES);
  });

  test('sin token no se sirve el comprobante', async () => {
    const { changeRequest } = await createStoreWithRequest('dueno-sintoken@techstore.com');

    expect(
      (await request(app).get(`/api/store-admin/plan-change-requests/${changeRequest.id}/receipt`))
        .status,
    ).toBe(401);
    expect(
      (await request(app).get(`/api/super-admin/plan-change-requests/${changeRequest.id}/receipt`))
        .status,
    ).toBe(401);
  });

  test('la URL vieja y sin autenticación ya no sirve los comprobantes', async () => {
    await request(app).get('/uploads/plan-receipts/1790828543249-712197071.png');

    const res = await request(app).get(`/uploads/plan-receipts/${RECEIPT_FILENAME}`);
    expect(res.status).toBe(404);
  });

  test('las fotos de reseñas siguen siendo públicas', async () => {
    const res = await request(app).get(`/uploads/reviews/${REVIEW_FILENAME}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
  });

  test('una solicitud sin comprobante responde 404 en ambos endpoints', async () => {
    const { owner, store } = await createStoreWithRequest('dueno-sincomprobante@techstore.com');
    const superAdmin = await createUser('super-sincomprobante@techstore.com', 'super_admin');
    const sinComprobante = await db.PlanChangeRequest.create({
      storeId: store.id,
      requestedTierId: targetTierId,
      requestedByUserId: owner.id,
      status: 'pending',
      receiptUrl: null,
    });

    const ownerToken = await loginToken(owner.email);
    const superToken = await loginToken(superAdmin.email);

    expect(
      (
        await request(app)
          .get(`/api/store-admin/plan-change-requests/${sinComprobante.id}/receipt`)
          .set('Authorization', `Bearer ${ownerToken}`)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`/api/super-admin/plan-change-requests/${sinComprobante.id}/receipt`)
          .set('Authorization', `Bearer ${superToken}`)
      ).status,
    ).toBe(404);
  });

  test('un receipt_url manipulado no permite leer archivos fuera de la carpeta', async () => {
    const { owner, changeRequest } = await createStoreWithRequest('dueno-traversal@techstore.com');
    const superAdmin = await createUser('super-traversal@techstore.com', 'super_admin');

    await changeRequest.update({
      receiptUrl: '/uploads/plan-receipts/../../.env',
    });

    const ownerToken = await loginToken(owner.email);
    const res = await request(app)
      .get(`/api/store-admin/plan-change-requests/${changeRequest.id}/receipt`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);

    const superToken = await loginToken(superAdmin.email);
    const superRes = await request(app)
      .get(`/api/super-admin/plan-change-requests/${changeRequest.id}/receipt`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(superRes.status).toBe(404);
  });

  test('una solicitud inexistente responde 404', async () => {
    const superAdmin = await createUser('super-inexistente@techstore.com', 'super_admin');
    const token = await loginToken(superAdmin.email);

    const res = await request(app)
      .get('/api/super-admin/plan-change-requests/999999/receipt')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
