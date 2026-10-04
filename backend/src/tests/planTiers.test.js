import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';
import { __setTransporterFactoryForTests } from '../services/mailer.js';
import { PLAN_RECEIPTS_DIR } from '../middleware/upload.middleware.js';

const DAY = 24 * 60 * 60 * 1000;

const TIER_SEED = [
  { name: 'Básico', price: 50000, productLimit: 20 },
  { name: 'Estándar', price: 100000, productLimit: 50 },
  { name: 'Premium', price: 180000, productLimit: null },
];

function installMockTransporter() {
  __setTransporterFactoryForTests(() => ({
    sendMail: async () => ({ messageId: '<mock@localhost>' }),
  }));
}

async function createUser(email, role) {
  return db.User.create({
    name: `User ${role}`,
    email,
    passwordHash: await bcrypt.hash('secret123', 10),
    role,
  });
}

async function loginToken(email) {
  const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return login.body.token;
}

async function createStore(ownerEmail, planTierId, overrides = {}) {
  const owner = await createUser(ownerEmail, 'store_admin');
  const base = ownerEmail.split('@')[0];
  const store = await db.Store.create({
    name: `Tienda ${base}`,
    slug: `tienda-${base}`,
    whatsappNumber: '+5491100000000',
    ownerUserId: owner.id,
    status: 'approved',
    planTierId,
    planStartedAt: new Date(Date.now() - DAY),
    planExpiresAt: new Date(Date.now() + 30 * DAY),
    planStatus: 'active',
    ...overrides,
  });
  // Las categorías son privadas: cada tienda de prueba nace con la suya.
  const [category] = await db.Category.bulkCreate(
    [{ name: 'Celulares', slug: 'celulares', storeId: store.id }],
    { returning: true },
  );
  categoryId = category.id;
  return { owner, store, category };
}

async function fillProducts(store, categoryId, count, prefix = 'prod') {
  for (let i = 0; i < count; i += 1) {
    await db.Product.create({
      name: `${prefix} ${i}`,
      slug: `${prefix}-${store.id}-${i}`,
      price: 100,
      stock: 5,
      categoryId,
      storeId: store.id,
    });
  }
}

function productPayload(categoryId, name) {
  return { name, slug: name.toLowerCase().replace(/\s+/g, '-'), price: 100, stock: 3, categoryId };
}

function applyPayload(slug, email) {
  return {
    name: 'Tienda Solicitud',
    slug,
    whatsapp_number: '+5491100000000',
    description: 'Tienda que nace con plan Basico.',
    owner: { name: 'Dueño', email, password: 'clave1234' },
  };
}

// --- Comprobantes de transferencia -----------------------------------------
export const FIVE_MB = 5 * 1024 * 1024;

function receiptFile(kind = 'png') {
  const files = {
    png: { buffer: Buffer.from('PNG-COMPROBANTE'), filename: 'comprobante.png', contentType: 'image/png' },
    jpg: { buffer: Buffer.from('JPG-COMPROBANTE'), filename: 'comprobante.jpg', contentType: 'image/jpeg' },
    webp: { buffer: Buffer.from('RIFF-WEBP-COMPROBANTE'), filename: 'comprobante.webp', contentType: 'image/webp' },
    pdf: { buffer: Buffer.from('%PDF-1.4 comprobante'), filename: 'comprobante.pdf', contentType: 'application/pdf' },
    txt: { buffer: Buffer.from('texto plano'), filename: 'comprobante.txt', contentType: 'text/plain' },
  };
  return files[kind] ?? files.png;
}

/** POST multipart con comprobante (flujo normal del store_admin). */
function postChangeRequest(token, requestedTierId, receipt = receiptFile('png')) {
  const req = request(app)
    .post('/api/store-admin/plan-change-requests')
    .set('Authorization', `Bearer ${token}`)
    .field('requested_tier_id', String(requestedTierId));
  if (receipt) {
    req.attach('receipt', receipt.buffer, {
      filename: receipt.filename,
      contentType: receipt.contentType,
    });
  }
  return req;
}

/** Nombres de los comprobantes que hay ahora mismo en la carpeta de uploads. */
function receiptsOnDisk() {
  return fs.readdirSync(PLAN_RECEIPTS_DIR).sort();
}

let categoryId;
let basico;
let estandar;
let premium;
let superAdmin;

describe('Niveles de plan y solicitudes de cambio', () => {
  beforeEach(async () => {
    await db.sequelize.query(
      'TRUNCATE TABLE plan_change_requests, audit_logs, products, order_items, orders, categories, stores, users, plan_tiers CASCADE;',
    );
    installMockTransporter();
    [basico, estandar, premium] = await db.PlanTier.bulkCreate(TIER_SEED, { returning: true });
    superAdmin = await createUser('root@techstore.com', 'super_admin');
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  describe('GET /api/plan-tiers', () => {
    test('es público y devuelve los 3 niveles con precio y límite', async () => {
      const res = await request(app).get('/api/plan-tiers');

      expect(res.status).toBe(200);
      expect(res.body.tiers).toHaveLength(3);
      expect(res.body.tiers.map((t) => t.name)).toEqual(['Básico', 'Estándar', 'Premium']);
      expect(res.body.tiers.map((t) => t.price)).toEqual([50000, 100000, 180000]);
      expect(res.body.tiers.map((t) => t.productLimit)).toEqual([20, 50, null]);
      expect(res.body.defaultTierName).toBe('Básico');
    });
  });

  describe('límite de productos', () => {
    test('permite crear hasta el límite y bloquea el siguiente con 403 y mensaje claro', async () => {
      const { store, owner } = await createStore('limite-a@techstore.com', basico.id);
      await fillProducts(store, categoryId, 20, 'a-prod');
      const token = await loginToken(owner.email);

      const ok = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(productPayload(categoryId, 'Reemplazo A'));
      expect(ok.status).toBe(403);
      expect(ok.body.error).toBe(
        'Alcanzaste el límite de 20 productos de tu plan Básico. Solicitá un cambio de plan para publicar más.',
      );

      const desactivo = await request(app)
        .put(`/api/products/${(await db.Product.findOne({ where: { storeId: store.id } })).id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ is_active: false });
      expect(desactivo.status).toBe(200);

      const nuevo = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(productPayload(categoryId, 'Producto Nuevo A'));
      expect(nuevo.status).toBe(201);
      expect(nuevo.body.product.name).toBe('Producto Nuevo A');
    });

    test('cuenta solo los productos activos de esa tienda', async () => {
      const { store, owner } = await createStore('limite-b@techstore.com', basico.id);
      await fillProducts(store, categoryId, 20, 'b-prod');
      const token = await loginToken(owner.email);

      const bloqueado = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(productPayload(categoryId, 'Producto B'));
      expect(bloqueado.status).toBe(403);

      const primero = await db.Product.findOne({
        where: { storeId: store.id },
        order: [['id', 'ASC']],
      });
      await primero.update({ isActive: false });

      const permitido = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(productPayload(categoryId, 'Producto B'));
      expect(permitido.status).toBe(201);
      expect(
        await db.Product.count({ where: { storeId: store.id, isActive: true } }),
      ).toBe(20);
    });

    test('el plan Estándar permite 50 productos y el Premium no limita', async () => {
      const { store: tiendaEstandar, owner: ownerEstandar } = await createStore(
        'limite-c@techstore.com',
        estandar.id,
      );
      await fillProducts(tiendaEstandar, categoryId, 50, 'c-prod');
      const tokenEstandar = await loginToken(ownerEstandar.email);

      const bloqueado = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenEstandar}`)
        .send(productPayload(categoryId, 'Producto C'));
      expect(bloqueado.status).toBe(403);
      expect(bloqueado.body.error).toContain('límite de 50 productos de tu plan Estándar');

      const { store: tiendaPremium, owner: ownerPremium } = await createStore(
        'limite-d@techstore.com',
        premium.id,
      );
      await fillProducts(tiendaPremium, categoryId, 60, 'd-prod');
      const tokenPremium = await loginToken(ownerPremium.email);

      const permitido = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenPremium}`)
        .send(productPayload(categoryId, 'Producto D'));
      expect(permitido.status).toBe(201);
    });

    test('el panel expone el plan actual y el uso de productos', async () => {
      const { store, owner } = await createStore('limite-e@techstore.com', basico.id);
      await fillProducts(store, categoryId, 20, 'e-prod');
      const token = await loginToken(owner.email);

      const res = await request(app)
        .get('/api/store-admin/plan')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.tier).toMatchObject({ id: basico.id, name: 'Básico', price: 50000, productLimit: 20 });
      expect(res.body.activeProducts).toBe(20);
      expect(res.body.productLimit).toBe(20);
      expect(res.body.productLimitReached).toBe(true);
    });
  });

  describe('tiendas nuevas', () => {
    test('la tienda aprobada nace en el plan Básico', async () => {
      const applied = await request(app)
        .post('/api/stores/apply')
        .send(applyPayload('tienda-nueva-basico', 'nueva-basico@techstore.com'));
      expect(applied.status).toBe(201);

      const tokenAdmin = await loginToken(superAdmin.email);
      const approved = await request(app)
        .put(`/api/admin/store-applications/${applied.body.application.id}/approve`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(approved.status).toBe(200);

      const store = await db.Store.findOne({ where: { slug: 'tienda-nueva-basico' } });
      expect(store.planTierId).toBe(basico.id);
      expect(store.status).toBe('approved');
    });
  });

  describe('POST /api/store-admin/plan-change-requests', () => {
    test('crea la solicitud en pending', async () => {
      const { owner } = await createStore('pcr-a@techstore.com', basico.id);
      const token = await loginToken(owner.email);

      const res = await postChangeRequest(token, premium.id);

      expect(res.status).toBe(201);
      expect(res.body.request.status).toBe('pending');
      expect(res.body.request.requestedTier).toMatchObject({ id: premium.id, name: 'Premium' });
      expect(res.body.request.store).toMatchObject({ id: expect.any(Number) });
      expect(res.body.request.reviewedAt).toBeNull();
    });

    test('exige rol store_admin', async () => {
      const customer = await createUser('cliente-x@techstore.com', 'customer');
      const token = await loginToken(customer.email);

      const res = await postChangeRequest(token, premium.id);

      expect(res.status).toBe(403);
    });

    test('rechaza si ya hay una solicitud pendiente', async () => {
      const { owner } = await createStore('pcr-b@techstore.com', basico.id);
      const token = await loginToken(owner.email);

      const first = await postChangeRequest(token, premium.id);
      expect(first.status).toBe(201);

      const second = await postChangeRequest(token, estandar.id);
      expect(second.status).toBe(409);
      expect(second.body.error).toContain('pendiente');
      expect(await db.PlanChangeRequest.count()).toBe(1);
    });

    test('rechaza pedir el plan que ya tiene y un tier inexistente', async () => {
      const { owner } = await createStore('pcr-c@techstore.com', basico.id);
      const token = await loginToken(owner.email);

      const mismo = await postChangeRequest(token, basico.id);
      expect(mismo.status).toBe(409);
      expect(mismo.body.error).toContain('Básico');

      const inexistente = await postChangeRequest(token, 9999);
      expect(inexistente.status).toBe(404);

      const sinBody = await request(app)
        .post('/api/store-admin/plan-change-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(sinBody.status).toBe(400);
    });

    test('el store_admin solo ve sus propias solicitudes', async () => {
      const { owner: ownerA } = await createStore('pcr-d@techstore.com', basico.id);
      const { owner: ownerB } = await createStore('pcr-e@techstore.com', basico.id);
      const tokenA = await loginToken(ownerA.email);
      const tokenB = await loginToken(ownerB.email);

      await postChangeRequest(tokenA, premium.id);
      await postChangeRequest(tokenB, estandar.id);

      const resA = await request(app)
        .get('/api/store-admin/plan-change-requests')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resA.status).toBe(200);
      expect(resA.body.requests).toHaveLength(1);
      expect(resA.body.requests[0].requestedTier.name).toBe('Premium');

      const resB = await request(app)
        .get('/api/store-admin/plan-change-requests')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(resB.body.requests[0].requestedTier.name).toBe('Estándar');
    });
  });

  describe('comprobante obligatorio', () => {
    test('sin comprobante devuelve 400 con mensaje claro y no crea la solicitud', async () => {
      const { owner } = await createStore('rcp-a@techstore.com', basico.id);
      const token = await loginToken(owner.email);

      const res = await postChangeRequest(token, premium.id, null);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('comprobante');
      expect(await db.PlanChangeRequest.count()).toBe(0);
    });

    test('con imagen devuelve 201 y el comprobante se sirve por el endpoint autenticado', async () => {
      const { owner } = await createStore('rcp-b@techstore.com', basico.id);
      const token = await loginToken(owner.email);

      const res = await postChangeRequest(token, premium.id, receiptFile('png'));

      expect(res.status).toBe(201);
      expect(res.body.request.receiptUrl).toMatch(/^\/uploads\/plan-receipts\/.+\.png$/);

      // La URL vieja ya no sirve el comprobante: ahora exige token.
      const anonymous = await request(app).get(res.body.request.receiptUrl);
      expect(anonymous.status).toBe(404);

      const served = await request(app)
        .get(`/api/store-admin/plan-change-requests/${res.body.request.id}/receipt`)
        .set('Authorization', `Bearer ${token}`);
      expect(served.status).toBe(200);
    });

    test.each(['jpg', 'webp', 'pdf'])('acepta comprobante %s', async (kind) => {
      const { owner } = await createStore(`rcp-${kind}@techstore.com`, basico.id);
      const token = await loginToken(owner.email);

      const res = await postChangeRequest(token, premium.id, receiptFile(kind));

      expect(res.status).toBe(201);
      expect(res.body.request.receiptUrl).toMatch(
        new RegExp(`^/uploads/plan-receipts/.+\\.${kind === 'pdf' ? 'pdf' : kind}$`),
      );
    });

    test('un tipo de archivo inválido devuelve 400', async () => {
      const { owner } = await createStore('rcp-c@techstore.com', basico.id);
      const token = await loginToken(owner.email);

      const res = await postChangeRequest(token, premium.id, receiptFile('txt'));

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('JPG, PNG, WebP');
      expect(await db.PlanChangeRequest.count()).toBe(0);
    });

    test('un comprobante de más de 5 MB devuelve 400', async () => {
      const { owner } = await createStore('rcp-d@techstore.com', basico.id);
      const token = await loginToken(owner.email);
      const grande = { buffer: Buffer.alloc(FIVE_MB + 1024), filename: 'grande.png', contentType: 'image/png' };

      const res = await postChangeRequest(token, premium.id, grande);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('5 MB');
      expect(await db.PlanChangeRequest.count()).toBe(0);
    });

    test('el listado del super_admin incluye receiptUrl y el comprobante abre con su token', async () => {
      const { owner } = await createStore('rcp-e@techstore.com', basico.id);
      const token = await loginToken(owner.email);
      await postChangeRequest(token, premium.id, receiptFile('png'));

      const tokenAdmin = await loginToken(superAdmin.email);
      const res = await request(app)
        .get('/api/super-admin/plan-change-requests?status=pending')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.requests).toHaveLength(1);
      expect(res.body.requests[0].receiptUrl).toMatch(/^\/uploads\/plan-receipts\/.+\.png$/);

      const anonymous = await request(app).get(res.body.requests[0].receiptUrl);
      expect(anonymous.status).toBe(404);

      const served = await request(app)
        .get(`/api/super-admin/plan-change-requests/${res.body.requests[0].id}/receipt`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(served.status).toBe(200);
    });

    test('el listado del store_admin también incluye receiptUrl', async () => {
      const { owner } = await createStore('rcp-f@techstore.com', basico.id);
      const token = await loginToken(owner.email);
      await postChangeRequest(token, premium.id, receiptFile('pdf'));

      const res = await request(app)
        .get('/api/store-admin/plan-change-requests')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.requests[0].receiptUrl).toMatch(/^\/uploads\/plan-receipts\/.+\.pdf$/);
    });

    test('el comprobante sobrevive a la aprobación', async () => {
      const { owner } = await createStore('rcp-g@techstore.com', basico.id);
      const token = await loginToken(owner.email);
      const created = await postChangeRequest(token, premium.id, receiptFile('png'));
      const tokenAdmin = await loginToken(superAdmin.email);

      const approved = await request(app)
        .put(`/api/super-admin/plan-change-requests/${created.body.request.id}/approve`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(approved.status).toBe(200);
      expect(approved.body.request.receiptUrl).toBe(created.body.request.receiptUrl);
    });
  });

  describe('limpieza de comprobantes huérfanos', () => {
    // multer escribe el archivo antes de que el controller valide nada, así que cada
    // rechazo tiene que borrarlo. Si la ruta se resuelve con process.cwd() en vez de
    // con la del módulo, el unlink apunta a otro lado y el huérfano queda en disco
    // (el .catch(() => {}) lo oculta), por eso se compara el contenido de la carpeta.
    test('si el tierId es inválido, el comprobante se borra de verdad', async () => {
      const { owner } = await createStore('huerfano-z@techstore.com', basico.id);
      const token = await loginToken(owner.email);
      const before = receiptsOnDisk();

      const res = await postChangeRequest(token, 'no-es-un-numero', receiptFile('png'));

      expect(res.status).toBe(400);
      expect(await db.PlanChangeRequest.count()).toBe(0);
      expect(receiptsOnDisk()).toEqual(before);
    });

    test('si falta el tierId, el comprobante se borra de verdad', async () => {
      const { owner } = await createStore('huerfano-y@techstore.com', basico.id);
      const token = await loginToken(owner.email);
      const before = receiptsOnDisk();

      const res = await postChangeRequest(token, undefined, receiptFile('png'));

      expect(res.status).toBe(400);
      expect(await db.PlanChangeRequest.count()).toBe(0);
      expect(receiptsOnDisk()).toEqual(before);
    });

    test('si el plan solicitado no existe, el comprobante se borra de verdad', async () => {
      const { owner } = await createStore('huerfano-a@techstore.com', basico.id);
      const token = await loginToken(owner.email);
      const before = receiptsOnDisk();

      const res = await postChangeRequest(token, 9999, receiptFile('png'));

      expect(res.status).toBe(404);
      expect(await db.PlanChangeRequest.count()).toBe(0);
      expect(receiptsOnDisk()).toEqual(before);
    });

    test('si se pide el plan que ya tiene, el comprobante se borra de verdad', async () => {
      const { owner } = await createStore('huerfano-b@techstore.com', basico.id);
      const token = await loginToken(owner.email);
      const before = receiptsOnDisk();

      const res = await postChangeRequest(token, basico.id, receiptFile('png'));

      expect(res.status).toBe(409);
      expect(await db.PlanChangeRequest.count()).toBe(0);
      expect(receiptsOnDisk()).toEqual(before);
    });

    test('si ya hay una solicitud pendiente, el comprobante se borra de verdad', async () => {
      const { owner } = await createStore('huerfano-c@techstore.com', basico.id);
      const token = await loginToken(owner.email);
      await postChangeRequest(token, premium.id, receiptFile('png'));
      const before = receiptsOnDisk();

      const res = await postChangeRequest(token, estandar.id, receiptFile('png'));

      expect(res.status).toBe(409);
      expect(await db.PlanChangeRequest.count()).toBe(1);
      expect(receiptsOnDisk()).toEqual(before);
    });

    test('el comprobante de una solicitud creada sí queda en la carpeta', async () => {
      const { owner } = await createStore('huerfano-d@techstore.com', basico.id);
      const token = await loginToken(owner.email);
      const before = receiptsOnDisk();

      const res = await postChangeRequest(token, premium.id, receiptFile('png'));

      expect(res.status).toBe(201);
      const receiptName = path.basename(res.body.request.receiptUrl);
      const after = receiptsOnDisk();
      expect(after).toHaveLength(before.length + 1);
      expect(after).toContain(receiptName);
    });
  });

  describe('revisión del super_admin', () => {
    async function pendingRequest() {
      const { store, owner } = await createStore('apr-a@techstore.com', basico.id);
      const token = await loginToken(owner.email);
      const created = await postChangeRequest(token, premium.id);
      return { store, owner, requestId: created.body.request.id };
    }

    test('lista todas las solicitudes y filtra por status', async () => {
      await pendingRequest();
      const tokenAdmin = await loginToken(superAdmin.email);

      const all = await request(app)
        .get('/api/super-admin/plan-change-requests')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(all.status).toBe(200);
      expect(all.body.requests).toHaveLength(1);
      expect(all.body.requests[0].store.name).toContain('Tienda apr-a');

      const pending = await request(app)
        .get('/api/super-admin/plan-change-requests?status=pending')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(pending.body.requests).toHaveLength(1);

      const approved = await request(app)
        .get('/api/super-admin/plan-change-requests?status=approved')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(approved.body.requests).toHaveLength(0);

      const bad = await request(app)
        .get('/api/super-admin/plan-change-requests?status=zzz')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(bad.status).toBe(400);
    });

    test('aprobar cambia el tier de la tienda y deja audit log', async () => {
      const { store, requestId } = await pendingRequest();
      const tokenAdmin = await loginToken(superAdmin.email);

      const res = await request(app)
        .put(`/api/super-admin/plan-change-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('approved');
      expect(res.body.request.reviewedBy.id).toBe(superAdmin.id);
      expect(res.body.store.planTierId).toBe(premium.id);
      const reloaded = await db.Store.findByPk(store.id);
      expect(reloaded.planTierId).toBe(premium.id);

      const audit = await db.AuditLog.findOne({ where: { action: 'approve_plan_change' } });
      expect(audit.targetType).toBe('plan_change_request');
      expect(audit.details.newTierName).toBe('Premium');
    });

    test('rechazar exige motivo y no cambia el tier de la tienda', async () => {
      const { store, requestId } = await pendingRequest();
      const tokenAdmin = await loginToken(superAdmin.email);

      const sinMotivo = await request(app)
        .put(`/api/super-admin/plan-change-requests/${requestId}/reject`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({});
      expect(sinMotivo.status).toBe(400);

      const res = await request(app)
        .put(`/api/super-admin/plan-change-requests/${requestId}/reject`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ rejected_reason: 'Coordinamos el pago por fuera.' });

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('rejected');
      expect(res.body.request.rejectedReason).toBe('Coordinamos el pago por fuera.');

      const reloaded = await db.Store.findByPk(store.id);
      expect(reloaded.planTierId).toBe(basico.id);

      const audit = await db.AuditLog.findOne({ where: { action: 'reject_plan_change' } });
      expect(audit.details.reason).toBe('Coordinamos el pago por fuera.');
    });

    test('no se puede reprocesar una solicitud ya revisada', async () => {
      const { requestId } = await pendingRequest();
      const tokenAdmin = await loginToken(superAdmin.email);

      const first = await request(app)
        .put(`/api/super-admin/plan-change-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(first.status).toBe(200);

      const second = await request(app)
        .put(`/api/super-admin/plan-change-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(second.status).toBe(409);

      const reject = await request(app)
        .put(`/api/super-admin/plan-change-requests/${requestId}/reject`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ rejected_reason: 'tarde' });
      expect(reject.status).toBe(409);
    });

    test('un store_admin no puede aprobar ni listar solicitudes globales', async () => {
      const { owner, requestId } = await pendingRequest();
      const tokenTienda = await loginToken(owner.email);

      const approve = await request(app)
        .put(`/api/super-admin/plan-change-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${tokenTienda}`);
      expect(approve.status).toBe(403);

      const list = await request(app)
        .get('/api/super-admin/plan-change-requests')
        .set('Authorization', `Bearer ${tokenTienda}`);
      expect(list.status).toBe(403);
    });

    test('404 para solicitud inexistente', async () => {
      const tokenAdmin = await loginToken(superAdmin.email);
      const res = await request(app)
        .put('/api/super-admin/plan-change-requests/9999/approve')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.status).toBe(404);
    });
  });

  describe('desbloqueo tras el cambio de plan', () => {
    test('al aprobar Premium la tienda vuelve a poder publicar', async () => {
      const { store, owner } = await createStore('fin-a@techstore.com', basico.id);
      await fillProducts(store, categoryId, 20, 'f-prod');
      const token = await loginToken(owner.email);

      const bloqueado = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(productPayload(categoryId, 'Producto F'));
      expect(bloqueado.status).toBe(403);

      const created = await postChangeRequest(token, premium.id);

      const tokenAdmin = await loginToken(superAdmin.email);
      await request(app)
        .put(`/api/super-admin/plan-change-requests/${created.body.request.id}/approve`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      const permitido = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(productPayload(categoryId, 'Producto F'));
      expect(permitido.status).toBe(201);
    });
  });
});
