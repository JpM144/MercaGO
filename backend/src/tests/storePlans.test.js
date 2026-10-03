import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';
import { __setTransporterFactoryForTests } from '../services/mailer.js';
import { getEffectivePlanStatus, addOneMonth } from '../utils/plan.util.js';

const DAY = 24 * 60 * 60 * 1000;
const sentMails = [];

function installMockTransporter() {
  sentMails.length = 0;
  __setTransporterFactoryForTests(() => ({
    sendMail: async (mail) => {
      sentMails.push(mail);
      return { messageId: '<mock@localhost>' };
    },
  }));
}

async function createUser(email, role) {
  return db.User.create({
    name: 'User',
    email,
    passwordHash: await bcrypt.hash('secret123', 10),
    role,
  });
}

async function loginToken(email) {
  const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return login.body.token;
}

async function createStore(ownerEmail, plan = {}) {
  const owner = await createUser(ownerEmail, 'store_admin');
  const base = ownerEmail.split('@')[0];
  const store = await db.Store.create({
    name: `Tienda ${base}`,
    slug: `tienda-${base}`,
    whatsappNumber: '+5491100000000',
    ownerUserId: owner.id,
    status: 'approved',
    planStartedAt: plan.planStartedAt ?? new Date(Date.now() - DAY),
    planExpiresAt: plan.planExpiresAt ?? new Date(Date.now() + 30 * DAY),
    planStatus: plan.planStatus ?? 'active',
  });
  // Las categorías son privadas: cada tienda de prueba nace con la suya.
  const [category] = await db.Category.bulkCreate(
    [{ name: 'Celulares', slug: 'celulares', storeId: store.id }],
    { returning: true },
  );
  return { owner, store, category };
}

async function addProduct(store, categoryId, name, slug) {
  return db.Product.create({ name, slug, price: 100, stock: 5, categoryId, storeId: store.id });
}

function applyPayload(slug, email) {
  return {
    name: 'Tienda Plan',
    slug,
    whatsapp_number: '+5491100000000',
    description: 'Tienda de prueba de planes.',
    owner: { name: 'Prospecto', email, password: 'clave1234' },
  };
}

describe('Plan de tiendas', () => {
  beforeEach(async () => {
    await db.sequelize.query(
      'TRUNCATE TABLE store_applications, categories, stores, users CASCADE;',
    );
    installMockTransporter();
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('estado efectivo: activo con vencimiento lejano', async () => {
    const { store } = await createStore('det-a@techstore.com');
    const plan = getEffectivePlanStatus(store);
    expect(plan.status).toBe('active');
    expect(plan.expiringSoon).toBe(false);
  });

  test('estado efectivo: próximo a vencer → active con expiringSoon', async () => {
    const { store } = await createStore('det-b@techstore.com', {
      planExpiresAt: new Date(Date.now() + 1 * DAY),
    });
    const plan = getEffectivePlanStatus(store);
    expect(plan.status).toBe('active');
    expect(plan.expiringSoon).toBe(true);
  });

  test('estado efectivo: vencido sin acción manual → expired (sin escribir estado)', async () => {
    const { store, owner } = await createStore('det-c@techstore.com', {
      planExpiresAt: new Date(Date.now() - 60 * 1000),
    });
    const plan = getEffectivePlanStatus(store);
    expect(plan.status).toBe('expired');
    expect(plan.expiringSoon).toBe(false);

    const reloaded = await db.Store.findByPk(store.id);
    expect(reloaded.planStatus).toBe('active');

    const token = await loginToken(owner.email);
    const myPlan = await request(app)
      .get('/api/store-admin/plan')
      .set('Authorization', `Bearer ${token}`);
    expect(myPlan.status).toBe(200);
    expect(myPlan.body.planStatus).toBe('expired');
  });

  test('estado efectivo: paused y cancelled mandan tal cual', async () => {
    const { store: paused } = await createStore('det-d@techstore.com', { planStatus: 'paused' });
    expect(getEffectivePlanStatus(paused).status).toBe('paused');

    const { store: cancelled } = await createStore('det-e@techstore.com', {
      planStatus: 'cancelled',
    });
    expect(getEffectivePlanStatus(cancelled).status).toBe('cancelled');
  });

  test('catálogo público excluye tiendas pausadas, canceladas y vencidas', async () => {
    const { store: activa, category: catActiva } = await createStore('cat-a@techstore.com');
    const { store: pausada, category: catPausada } = await createStore('cat-b@techstore.com', {
      planStatus: 'paused',
    });
    const { store: cancelada, category: catCancelada } = await createStore('cat-c@techstore.com', {
      planStatus: 'cancelled',
    });
    const { store: vencida, category: catVencida } = await createStore('cat-d@techstore.com', {
      planExpiresAt: new Date(Date.now() - 60 * 1000),
    });

    await addProduct(activa, catActiva.id, 'Producto Activo', 'producto-activo');
    await addProduct(pausada, catPausada.id, 'Producto Pausado', 'producto-pausado');
    await addProduct(cancelada, catCancelada.id, 'Producto Cancelado', 'producto-cancelado');
    await addProduct(vencida, catVencida.id, 'Producto Vencido', 'producto-vencido');

    const list = await request(app).get('/api/stores');
    const slugs = list.body.stores.map((s) => s.slug);
    expect(slugs).toContain(activa.slug);
    expect(slugs).not.toContain(pausada.slug);
    expect(slugs).not.toContain(cancelada.slug);
    expect(slugs).not.toContain(vencida.slug);

    expect((await request(app).get(`/api/stores/${activa.slug}`)).status).toBe(200);
    expect((await request(app).get(`/api/stores/${pausada.slug}`)).status).toBe(404);
    expect((await request(app).get(`/api/stores/${cancelada.slug}`)).status).toBe(404);
    expect((await request(app).get(`/api/stores/${vencida.slug}`)).status).toBe(404);

    const products = await request(app).get('/api/products');
    const names = products.body.products.map((p) => p.name);
    expect(names).toContain('Producto Activo');
    expect(names).not.toContain('Producto Pausado');
    expect(names).not.toContain('Producto Cancelado');
    expect(names).not.toContain('Producto Vencido');

    expect((await request(app).get('/api/products/producto-pausado')).status).toBe(404);
    expect((await request(app).get('/api/products/producto-vencido')).status).toBe(404);
  });

  test('store_admin bloqueado según el estado del plan', async () => {
    const { owner: pausadoOwner, store: pausada } = await createStore('blk-a@techstore.com', {
      planStatus: 'paused',
    });
    const { owner: expOwner, store: expirada } = await createStore('blk-b@techstore.com', {
      planExpiresAt: new Date(Date.now() - 60 * 1000),
    });
    const { owner: cancelOwner, store: cancelada } = await createStore('blk-c@techstore.com', {
      planStatus: 'cancelled',
    });

    const cases = [
      { owner: pausadoOwner, store: pausada, message: 'pausada' },
      { owner: expOwner, store: expirada, message: 'venció' },
      { owner: cancelOwner, store: cancelada, message: 'cancelada' },
    ];

    for (const item of cases) {
      const token = await loginToken(item.owner.email);
      const category = await db.Category.findOne({ where: { storeId: item.store.id } });

      const create = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nuevo', price: 10, stock: 1, categoryId: category.id });
      expect(create.status).toBe(403);
      expect(create.body.error).toContain(item.message);

      const list = await request(app)
        .get('/api/store-admin/products')
        .set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(403);
      expect(list.body.error).toContain(item.message);
    }

    expect(pausada.planStatus).toBe('paused');
    expect(cancelada.planStatus).toBe('cancelled');
  });

  test('pause → reactivate → cancel cambian el estado y el catálogo lo refleja', async () => {
    const superToken = await loginToken(
      (await createUser('super-plan@techstore.com', 'super_admin')).email,
    );
    const { store, owner, category } = await createStore('ciclo@techstore.com');
    await addProduct(store, category.id, 'Producto Ciclo', 'producto-ciclo');

    let res = await request(app)
      .put(`/api/super-admin/stores/${store.id}/pause`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.store.planStatus).toBe('paused');

    res = await request(app)
      .put(`/api/super-admin/stores/${store.id}/reactivate`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.store.planStatus).toBe('active');

    res = await request(app)
      .put(`/api/super-admin/stores/${store.id}/cancel`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.store.planStatus).toBe('cancelled');

    const reloadedAfterCancel = await db.Store.findByPk(store.id);
    expect(reloadedAfterCancel.planStatus).toBe('cancelled');

    res = await request(app)
      .put(`/api/super-admin/stores/${store.id}/reactivate`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.store.planStatus).toBe('active');

    const catalogAfterRequeue = await request(app).get(`/api/stores/${store.slug}`);
    expect(catalogAfterRequeue.status).toBe(200);

    const ownerToken = await loginToken(owner.email);
    const myPlan = await request(app)
      .get('/api/store-admin/plan')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(myPlan.body.planStatus).toBe('active');
    expect(myPlan.body.planExpiresAt).not.toBeNull();
    expect(typeof myPlan.body.expiringSoon).toBe('boolean');
  });

  test('pausar o cancelar no tocan plan_expires_at', async () => {
    const superToken = await loginToken(
      (await createUser('super-nodate@techstore.com', 'super_admin')).email,
    );
    const { store } = await createStore('nodate@techstore.com', {
      planExpiresAt: new Date(Date.now() + 15 * DAY),
    });
    const original = store.planExpiresAt.getTime();

    await request(app)
      .put(`/api/super-admin/stores/${store.id}/pause`)
      .set('Authorization', `Bearer ${superToken}`);
    await request(app)
      .put(`/api/super-admin/stores/${store.id}/reactivate`)
      .set('Authorization', `Bearer ${superToken}`);
    await request(app)
      .put(`/api/super-admin/stores/${store.id}/cancel`)
      .set('Authorization', `Bearer ${superToken}`);

    const reloaded = await db.Store.findByPk(store.id);
    expect(reloaded.planExpiresAt.getTime()).toBe(original);
  });

  test('reactivar una tienda vencida devuelve expired (el vencimiento se deriva de la fecha)', async () => {
    const superToken = await loginToken(
      (await createUser('super-vencid@techstore.com', 'super_admin')).email,
    );
    const { store } = await createStore('vencid-re@techstore.com', {
      planExpiresAt: new Date(Date.now() - 60 * 1000),
    });

    const res = await request(app)
      .put(`/api/super-admin/stores/${store.id}/reactivate`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.store.planStatus).toBe('expired');

    const reloaded = await db.Store.findByPk(store.id);
    expect(reloaded.planStatus).toBe('active');
  });

  test('super-admin lista todas las tiendas con su estado efectivo y vencimiento', async () => {
    const superToken = await loginToken(
      (await createUser('super-list@techstore.com', 'super_admin')).email,
    );
    const { store: activa } = await createStore('list-a@techstore.com');
    const { store: pausada } = await createStore('list-b@techstore.com', { planStatus: 'paused' });

    const res = await request(app)
      .get('/api/super-admin/stores')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);

    const all = res.body.stores;
    expect(all.map((s) => s.slug)).toEqual(
      expect.arrayContaining([activa.slug, pausada.slug]),
    );
    const found = all.find((s) => s.slug === activa.slug);
    expect(found.planStatus).toBe('active');
    expect(found.planExpiresAt).not.toBeNull();
    expect(found.owner?.email).toBe('list-a@techstore.com');

    const p = all.find((s) => s.slug === pausada.slug);
    expect(p.planStatus).toBe('paused');
  });

  test('los endpoints de super-admin exigen rol super_admin', async () => {
    const customer = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Cliente', email: 'cliente-plan@techstore.com', password: 'secret123' });
    const customerToken = customer.body.token;

    const { store } = await createStore('perm@techstore.com');
    const adminToken = await loginToken(
      (await createUser('admin-plan@techstore.com', 'admin')).email,
    );
    const superToken = await loginToken(
      (await createUser('super-perm@techstore.com', 'super_admin')).email,
    );

    for (const token of [customerToken, adminToken]) {
      expect(
        (await request(app).get('/api/super-admin/stores').set('Authorization', `Bearer ${token}`))
          .status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .put(`/api/super-admin/stores/${store.id}/pause`)
            .set('Authorization', `Bearer ${token}`)
        ).status,
      ).toBe(403);
    }

    const ok = await request(app)
      .get('/api/super-admin/stores')
      .set('Authorization', `Bearer ${superToken}`);
    expect(ok.status).toBe(200);
  });

  test('aprobar una solicitud setea plan_started_at y plan_expires_at (+1 mes)', async () => {
    const superToken = await loginToken(
      (await createUser('super-appr@techstore.com', 'super_admin')).email,
    );
    const apply = await request(app).post('/api/stores/apply').send(
      applyPayload('tienda-aprob-plan', 'aprob-plan@techstore.com'),
    );
    expect(apply.status).toBe(201);

    const approve = await request(app)
      .put(`/api/admin/store-applications/${apply.body.application.id}/approve`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(approve.status).toBe(200);

    const store = await db.Store.findOne({ where: { slug: 'tienda-aprob-plan' } });
    expect(store).not.toBeNull();
    expect(store.planStartedAt).not.toBeNull();
    expect(store.planExpiresAt).not.toBeNull();

    const diffMs = Math.abs(
      new Date(store.planExpiresAt).getTime() - addOneMonth(store.planStartedAt).getTime(),
    );
    expect(diffMs).toBeLessThan(60 * 1000);

    const storeAdmin = await db.User.findOne({ where: { email: 'aprob-plan@techstore.com' } });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: storeAdmin.email, password: 'clave1234' });
    const plan = await request(app)
      .get('/api/store-admin/plan')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(plan.status).toBe(200);
    expect(plan.body.planStatus).toBe('active');
  });
});