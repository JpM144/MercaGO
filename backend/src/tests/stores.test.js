import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';

async function tokenFor(email, role = 'customer') {
  if (role === 'customer') {
    await request(app).post('/api/auth/register').send({
      name: 'Customer User',
      email,
      password: 'secret123',
    });
  } else {
    const passwordHash = await bcrypt.hash('secret123', 10);
    await db.User.create({ name: 'Role User', email, passwordHash, role });
  }

  if (role === 'store_admin') {
    const user = await db.User.findOne({ where: { email } });
    await db.Store.findOrCreate({
      where: { slug: `store-${email.split('@')[0]}` },
      defaults: {
        name: `Tienda ${email.split('@')[0]}`,
        slug: `store-${email.split('@')[0]}`,
        whatsappNumber: '+541111111111',
        ownerUserId: user.id,
        status: 'approved',
      },
    });
  }

  const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return login.body.token;
}

async function createStoreFor(email, { status = 'pending', password = 'secret123' } = {}) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.User.create({
    name: 'Owner',
    email,
    passwordHash,
    role: 'store_admin',
  });
  const store = await db.Store.create({
    name: `Tienda de ${email.split('@')[0]}`,
    slug: `tienda-${email.split('@')[0]}`,
    whatsappNumber: '+5491100000000',
    ownerUserId: user.id,
    status,
  });
  return { user, store };
}

describe('Stores / Multi-tienda API', () => {
  beforeEach(async () => {
    await db.sequelize.query('TRUNCATE TABLE categories, stores, users CASCADE;');
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('GET /api/stores/me devuelve la tienda del store_admin', async () => {
    const token = await tokenFor('owner@techstore.com', 'store_admin');

    const res = await request(app).get('/api/stores/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.store.slug).toBe('store-owner');
    expect(res.body.store.owner.email).toBe('owner@techstore.com');
    expect(res.body.store.productCount).toBe(0);
  });

  test('GET /api/stores/me con customer devuelve 403', async () => {
    const token = await tokenFor('cliente@techstore.com');

    const res = await request(app).get('/api/stores/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('store_admin sin tienda asociada no usa los endpoints de tienda', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    await db.User.create({
      name: 'Owner Sin Tienda',
      email: 'sin-tienda@techstore.com',
      passwordHash,
      role: 'store_admin',
    });
    const login = await request(app).post('/api/auth/login').send({
      email: 'sin-tienda@techstore.com',
      password: 'secret123',
    });

    const res = await request(app)
      .get('/api/stores/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('tienda');
  });

  test('super_admin lista todas las tiendas con owner', async () => {
    const token = await tokenFor('super@techstore.com', 'super_admin');
    await createStoreFor('a@techstore.com');
    await createStoreFor('b@techstore.com', { status: 'approved' });

    const res = await request(app).get('/api/admin/stores').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.stores.length).toBe(2);
    expect(res.body.stores.every((s) => s.owner && s.owner.email)).toBe(true);
  });

  test('solo super_admin aprueba/rechaza tiendas (customer y store_admin dan 403)', async () => {
    const { store } = await createStoreFor('duena@techstore.com');
    const customerToken = await tokenFor('cliente@techstore.com');
    const storeAdminToken = await tokenFor('owner@techstore.com', 'store_admin');

    const asCustomer = await request(app)
      .put(`/api/admin/stores/${store.id}/status`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'approved' });
    expect(asCustomer.status).toBe(403);

    const asStoreAdmin = await request(app)
      .put(`/api/admin/stores/${store.id}/status`)
      .set('Authorization', `Bearer ${storeAdminToken}`)
      .send({ status: 'approved' });
    expect(asStoreAdmin.status).toBe(403);
  });

  test('super_admin aprueba una tienda pending', async () => {
    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    const { store } = await createStoreFor('nueva@techstore.com');

    const res = await request(app)
      .put(`/api/admin/stores/${store.id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.store.status).toBe('approved');
    expect(res.body.store.rejectedReason).toBeNull();
  });

  test('rechazar requiere rejected_reason y lo guarda', async () => {
    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    const { store } = await createStoreFor('nueva@techstore.com');

    const sinMotivo = await request(app)
      .put(`/api/admin/stores/${store.id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'rejected' });
    expect(sinMotivo.status).toBe(400);

    const res = await request(app)
      .put(`/api/admin/stores/${store.id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'rejected', rejected_reason: 'Documentación incompleta' });

    expect(res.status).toBe(200);
    expect(res.body.store.status).toBe('rejected');
    expect(res.body.store.rejectedReason).toBe('Documentación incompleta');
  });

  test('no se puede aprobar/rechazar una tienda que ya no está pending', async () => {
    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    const { store } = await createStoreFor('aprobada@techstore.com', { status: 'approved' });

    const res = await request(app)
      .put(`/api/admin/stores/${store.id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'rejected' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('pending');
  });

  test('status inválido en aprobación devuelve 400', async () => {
    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    const { store } = await createStoreFor('x@techstore.com');

    const res = await request(app)
      .put(`/api/admin/stores/${store.id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'shipped' });

    expect(res.status).toBe(400);
  });

  test('POST /api/stores/apply crea la solicitud pending sin token de sesión', async () => {
    const res = await request(app)
      .post('/api/stores/apply')
      .send({
        name: 'Mi Tienda',
        whatsapp_number: '+5491122334455',
        description: 'Vendo accesorios.',
        owner: { name: 'Nuevo Dueño', email: 'nuevo@techstore.com', password: 'clave1234' },
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('pendiente de revisión');
    expect(res.body.store.status).toBe('pending');
    expect(res.body.store.slug).toBe('mi-tienda');
    expect(res.body.owner.role).toBe('store_admin');
    expect(res.body.owner.email).toBe('nuevo@techstore.com');
    expect(res.body).not.toHaveProperty('token');

    const user = await db.User.findOne({ where: { email: 'nuevo@techstore.com' } });
    expect(user).not.toBeNull();
    expect(user.role).toBe('store_admin');

    const store = await db.Store.findByPk(res.body.store.id);
    expect(store.status).toBe('pending');
    expect(store.ownerUserId).toBe(user.id);
  });

  test('POST /api/stores/apply con email existente devuelve 409', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Cliente Existente',
      email: 'dup@techstore.com',
      password: 'secret123',
    });

    const res = await request(app)
      .post('/api/stores/apply')
      .send({
        name: 'Otra Tienda',
        whatsapp_number: '+5491122',
        owner: { name: 'Cliente Existente', email: 'dup@techstore.com', password: 'clave1234' },
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Ya existe un usuario con ese email.');
  });

  test('POST /api/stores/apply pide los datos mínimos del negocio y del dueño', async () => {
    const sinOwner = await request(app).post('/api/stores/apply').send({
      name: 'Sin Dueño',
      whatsapp_number: '+5491122',
    });
    expect(sinOwner.status).toBe(400);
    expect(sinOwner.body.error).toContain('owner.name');

    const sinWhatsapp = await request(app)
      .post('/api/stores/apply')
      .send({
        name: 'Sin WhatsApp',
        owner: { name: 'A', email: 'a@techstore.com', password: 'clave1234' },
      });
    expect(sinWhatsapp.status).toBe(400);
    expect(sinWhatsapp.body.error).toContain('whatsapp_number');
  });

  test('login y /me de un store_admin con tienda pending reflejan storeStatus', async () => {
    const applyRes = await request(app)
      .post('/api/stores/apply')
      .send({
        name: 'Pendiente Login',
        whatsapp_number: '+5491122',
        owner: { name: 'Dueño', email: 'pend-login@techstore.com', password: 'clave1234' },
      });
    expect(applyRes.status).toBe(201);

    const login = await request(app).post('/api/auth/login').send({
      email: 'pend-login@techstore.com',
      password: 'clave1234',
    });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('store_admin');
    expect(login.body.user.storeStatus).toBe('pending');

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.storeStatus).toBe('pending');
  });

  test('un store_admin con tienda pending no puede crear productos', async () => {
    const applyRes = await request(app)
      .post('/api/stores/apply')
      .send({
        name: 'Tienda Pendiente',
        whatsapp_number: '+5491122',
        owner: { name: 'Dueño', email: 'pend-cat@techstore.com', password: 'clave1234' },
      });
    expect(applyRes.status).toBe(201);

    const login = await request(app).post('/api/auth/login').send({
      email: 'pend-cat@techstore.com',
      password: 'clave1234',
    });
    const category = await db.Category.create({ name: 'Celulares', slug: 'celulares' });

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ name: 'Producto Precoz', price: 10, categoryId: category.id });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('aprobada');
  });

  test('tienda rechazada: login refleja el motivo y la gestión de productos sigue bloqueada', async () => {
    const applyRes = await request(app)
      .post('/api/stores/apply')
      .send({
        name: 'Tienda Rechazada',
        whatsapp_number: '+5491122',
        owner: { name: 'Dueño', email: 'rej-login@techstore.com', password: 'clave1234' },
      });
    expect(applyRes.status).toBe(201);

    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    const reject = await request(app)
      .put(`/api/admin/stores/${applyRes.body.store.id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'rejected', rejected_reason: 'Falta documentación' });
    expect(reject.status).toBe(200);

    const login = await request(app).post('/api/auth/login').send({
      email: 'rej-login@techstore.com',
      password: 'clave1234',
    });
    expect(login.status).toBe(200);
    expect(login.body.user.storeStatus).toBe('rejected');
    expect(login.body.user.storeRejectedReason).toBe('Falta documentación');

    const category = await db.Category.create({ name: 'Audio', slug: 'audio' });
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ name: 'No Debería Existir', price: 10, categoryId: category.id });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('aprobada');
  });

  test('GET /api/stores lista solo tiendas aprobadas con su conteo de productos', async () => {
    const { store: approved } = await createStoreFor('aprobada@techstore.com', {
      status: 'approved',
    });
    await createStoreFor('pendiente@techstore.com', { status: 'pending' });
    await createStoreFor('rechazada@techstore.com', { status: 'rejected' });

    const categories = await db.Category.bulkCreate([
      { name: 'Celulares', slug: 'celulares' },
      { name: 'Audio', slug: 'audio' },
    ]);
    await db.Product.bulkCreate([
      {
        name: 'P1',
        slug: 'pub-p1',
        price: 10,
        categoryId: categories[0].id,
        storeId: approved.id,
      },
      {
        name: 'P2',
        slug: 'pub-p2',
        price: 20,
        categoryId: categories[1].id,
        storeId: approved.id,
      },
    ]);

    const list = await request(app).get('/api/stores');

    expect(list.status).toBe(200);
    expect(list.body.stores.length).toBe(1);
    expect(list.body.stores[0].slug).toBe('tienda-aprobada');
    expect(list.body.stores[0].productCount).toBe(2);
    expect(list.body.stores[0]).not.toHaveProperty('ownerUserId');
    expect(list.body.stores[0]).not.toHaveProperty('owner');

    const pendingDetail = await request(app).get('/api/stores/tienda-pendiente');
    expect(pendingDetail.status).toBe(404);

    const rejectedDetail = await request(app).get('/api/stores/tienda-rechazada');
    expect(rejectedDetail.status).toBe(404);
  });

  test('GET /api/stores/:slug devuelve el detalle completo de una tienda aprobada', async () => {
    const { store } = await createStoreFor('detalle@techstore.com', { status: 'approved' });
    await store.update({
      description: 'Tienda de prueba',
      businessHours: 'Lun-Sáb 9-20',
      shippingInfo: 'Correo argentino',
      warrantyInfo: '6 meses',
      paymentMethods: 'Transferencia y tarjeta',
    });

    const res = await request(app).get('/api/stores/tienda-detalle');

    expect(res.status).toBe(200);
    expect(res.body.store.name).toBe('Tienda de detalle');
    expect(res.body.store.whatsappNumber).toBe('+5491100000000');
    expect(res.body.store.businessHours).toBe('Lun-Sáb 9-20');
    expect(res.body.store.shippingInfo).toBe('Correo argentino');
    expect(res.body.store.warrantyInfo).toBe('6 meses');
    expect(res.body.store.paymentMethods).toBe('Transferencia y tarjeta');
    expect(res.body.store.description).toBe('Tienda de prueba');
    expect(res.body.store.productCount).toBe(0);
    expect(res.body.store).not.toHaveProperty('ownerUserId');
    expect(res.body.store).not.toHaveProperty('owner');

    const noExiste = await request(app).get('/api/stores/no-existe');
    expect(noExiste.status).toBe(404);
  });

  test('GET /api/stores/:slug/products?featured=true trae los N productos más recientes con stock', async () => {
    const { store } = await createStoreFor('destacados@techstore.com', { status: 'approved' });
    const categories = await db.Category.bulkCreate([{ name: 'Celulares', slug: 'celulares' }]);
    const now = Date.now();
    await db.Product.bulkCreate([
      {
        name: 'F1',
        slug: 'des-f1',
        price: 10,
        categoryId: categories[0].id,
        storeId: store.id,
        stock: 1,
        createdAt: new Date(now - 5000),
      },
      {
        name: 'F2',
        slug: 'des-f2',
        price: 20,
        categoryId: categories[0].id,
        storeId: store.id,
        stock: 1,
        createdAt: new Date(now - 4000),
      },
      {
        name: 'F3',
        slug: 'des-f3',
        price: 30,
        categoryId: categories[0].id,
        storeId: store.id,
        stock: 1,
        createdAt: new Date(now - 3000),
      },
      {
        name: 'F4',
        slug: 'des-f4',
        price: 40,
        categoryId: categories[0].id,
        storeId: store.id,
        stock: 1,
        createdAt: new Date(now - 2000),
      },
      {
        name: 'F5',
        slug: 'des-f5',
        price: 50,
        categoryId: categories[0].id,
        storeId: store.id,
        stock: 0,
        createdAt: new Date(now - 1000),
      },
    ]);

    const res = await request(app)
      .get('/api/stores/tienda-destacados/products')
      .query({ featured: 'true' });

    expect(res.status).toBe(200);
    expect(res.body.store.slug).toBe('tienda-destacados');
    expect(res.body.products.length).toBe(4);
    expect(res.body.products.map((p) => p.slug)).toEqual(['des-f4', 'des-f3', 'des-f2', 'des-f1']);
    expect(res.body.products.every((p) => p.stock > 0)).toBe(true);
    expect(res.body.products[0]).toHaveProperty('isNew');

    await createStoreFor('pend-dest@techstore.com', { status: 'pending' });
    const pendingRes = await request(app).get('/api/stores/tienda-pend-dest/products');
    expect(pendingRes.status).toBe(404);
  });

  test('GET /api/stores/:slug/products scopea los filtros a esa tienda', async () => {
    const { store: a } = await createStoreFor('tienda-a@techstore.com', { status: 'approved' });
    const { store: b } = await createStoreFor('tienda-b@techstore.com', { status: 'approved' });
    const categories = await db.Category.bulkCreate([
      { name: 'Celulares', slug: 'celulares' },
      { name: 'Audio', slug: 'audio' },
    ]);
    await db.Product.bulkCreate([
      {
        name: 'A1',
        slug: 'sc-a1',
        price: 10,
        originalPrice: 15,
        categoryId: categories[0].id,
        storeId: a.id,
        stock: 1,
      },
      {
        name: 'A2',
        slug: 'sc-a2',
        price: 20,
        categoryId: categories[0].id,
        storeId: a.id,
        stock: 1,
      },
      {
        name: 'B1',
        slug: 'sc-b1',
        price: 30,
        categoryId: categories[1].id,
        storeId: b.id,
        stock: 1,
      },
    ]);

    const celulares = await request(app)
      .get('/api/stores/tienda-tienda-a/products')
      .query({ category: 'celulares' });

    expect(celulares.status).toBe(200);
    expect(celulares.body.products.map((p) => p.slug).sort()).toEqual(['sc-a1', 'sc-a2']);

    const onSale = await request(app)
      .get('/api/stores/tienda-tienda-a/products')
      .query({ onSale: 'true' });

    expect(onSale.body.products.length).toBe(1);
    expect(onSale.body.products[0].slug).toBe('sc-a1');
    expect(onSale.body.products[0].originalPrice).toBe(15);
    expect(onSale.body.products[0].originalPrice).toBeGreaterThan(onSale.body.products[0].price);

    const search = await request(app)
      .get('/api/stores/tienda-tienda-a/products')
      .query({ search: 'noexiste' });

    expect(search.body.products).toHaveLength(0);
  });

  test('GET /api/stores/:slug/categories lista categorías con conteo solo de esa tienda', async () => {
    const { store: a } = await createStoreFor('cats-a@techstore.com', { status: 'approved' });
    const { store: b } = await createStoreFor('cats-b@techstore.com', { status: 'approved' });
    const categories = await db.Category.bulkCreate([
      { name: 'Celulares', slug: 'celulares' },
      { name: 'Audio', slug: 'audio' },
      { name: 'Cargadores', slug: 'cargadores' },
    ]);
    await db.Product.bulkCreate([
      {
        name: 'A1',
        slug: 'cat-a1',
        price: 10,
        categoryId: categories[0].id,
        storeId: a.id,
        stock: 1,
      },
      {
        name: 'A2',
        slug: 'cat-a2',
        price: 20,
        categoryId: categories[0].id,
        storeId: a.id,
        stock: 1,
      },
      {
        name: 'A3',
        slug: 'cat-a3',
        price: 30,
        categoryId: categories[1].id,
        storeId: a.id,
        stock: 1,
      },
      {
        name: 'A4',
        slug: 'cat-a4',
        price: 40,
        categoryId: categories[1].id,
        storeId: a.id,
        stock: 0,
      },
      {
        name: 'B1',
        slug: 'cat-b1',
        price: 50,
        categoryId: categories[2].id,
        storeId: b.id,
        stock: 1,
      },
    ]);

    const res = await request(app).get('/api/stores/tienda-cats-a/categories');

    expect(res.status).toBe(200);
    expect(res.body.categories.length).toBe(2);
    expect(res.body.categories.find((c) => c.slug === 'celulares').productCount).toBe(2);
    expect(res.body.categories.find((c) => c.slug === 'audio').productCount).toBe(1);
    expect(res.body.categories.some((c) => c.slug === 'cargadores')).toBe(false);
  });

  test('el seed multi-tienda corre de cero y deja el catálogo ligado a TechStore', async () => {
    const { default: seeder } = await import('../seeders/20260924010000-categories-products.cjs');

    await seeder.up(db.sequelize.getQueryInterface(), db.Sequelize);

    expect(await db.Category.count()).toBe(11);
    expect(await db.Store.count()).toBe(1);
    expect(await db.Product.count()).toBe(26);

    const superAdmin = await db.User.findOne({ where: { role: 'super_admin' } });
    const storeAdmin = await db.User.findOne({ where: { role: 'store_admin' } });
    expect(superAdmin).not.toBeNull();
    expect(storeAdmin.email).toBe('admin@techstore.com');

    const store = await db.Store.findOne({ where: { slug: 'techstore' } });
    expect(store).not.toBeNull();
    expect(store.status).toBe('approved');
    expect(store.ownerUserId).toBe(storeAdmin.id);

    const products = await db.Product.findAll();
    expect(products.length).toBe(26);
    expect(products.every((p) => p.storeId === store.id)).toBe(true);

    const publicList = await request(app).get('/api/products').query({ limit: 50 });
    expect(publicList.status).toBe(200);
    expect(publicList.body.products.length).toBe(26);

    const onSale = await request(app).get('/api/products').query({ onSale: 'true', limit: 50 });
    expect(onSale.status).toBe(200);
    expect(onSale.body.products.length).toBe(7);
    expect(
      onSale.body.products.every((p) => p.originalPrice != null && p.originalPrice > p.price),
    ).toBe(true);

    const publicStores = await request(app).get('/api/stores');
    expect(publicStores.status).toBe(200);
    expect(publicStores.body.stores.length).toBe(1);
    expect(publicStores.body.stores[0].slug).toBe('techstore');
    expect(publicStores.body.stores[0].productCount).toBe(26);

    await seeder.down(db.sequelize.getQueryInterface());
    expect(await db.Product.count()).toBe(0);
    expect(await db.Category.count()).toBe(0);
    expect(await db.Store.count()).toBe(0);
  });
});
