import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';

const BASE = Date.now();
let celularesId;

async function seedCatalog() {
  const storeAdmin = await db.User.create({
    name: 'Store Owner',
    email: 'admin@techstore.com',
    passwordHash: await bcrypt.hash('secret123', 10),
    role: 'store_admin',
  });
  const store = await db.Store.create({
    name: 'Tienda Catálogo',
    slug: 'store-admin',
    whatsappNumber: '+541111111111',
    ownerUserId: storeAdmin.id,
    status: 'approved',
  });

  const categories = await db.Category.bulkCreate(
    [
      { name: 'Celulares', slug: 'celulares' },
      { name: 'Audio', slug: 'audio' },
      { name: 'Cargadores', slug: 'cargadores' },
    ],
    { returning: true },
  );
  const [celulares, audio] = categories;
  celularesId = celulares.id;

  await db.Product.bulkCreate([
    {
      name: 'iPhone 15',
      slug: 'iphone-15',
      description: 'Teléfono de Apple con Dynamic Island',
      price: 1299.99,
      stock: 25,
      categoryId: celulares.id,
      storeId: store.id,
      createdAt: new Date(BASE - 4000),
    },
    {
      name: 'Samsung Galaxy S24',
      slug: 'galaxy-s24',
      description: 'Flagship de Samsung con Galaxy AI',
      price: 1099.99,
      stock: 30,
      categoryId: celulares.id,
      storeId: store.id,
      createdAt: new Date(BASE - 3000),
    },
    {
      name: 'Xiaomi Redmi Note 13',
      slug: 'redmi-note-13',
      description: 'Buena relación precio calidad',
      price: 349.99,
      stock: 40,
      categoryId: celulares.id,
      storeId: store.id,
      createdAt: new Date(BASE - 2000),
    },
    {
      name: 'AirPods Pro 2',
      slug: 'airpods-pro-2',
      description: 'Auriculares con cancelación de ruido',
      price: 279.99,
      stock: 22,
      categoryId: audio.id,
      storeId: store.id,
      createdAt: new Date(BASE - 1000),
    },
    {
      name: 'Sony WH-1000XM5',
      slug: 'sony-wh-1000xm5',
      description: 'Cancelación de ruido líder de la industria',
      price: 399.99,
      stock: 15,
      categoryId: audio.id,
      storeId: store.id,
      createdAt: new Date(BASE),
    },
  ]);
}

async function tokenFor(email, role = 'customer') {
  if (role === 'admin' || role === 'super_admin') {
    const passwordHash = await bcrypt.hash('secret123', 10);
    await db.User.create({ name: 'Admin User', email, passwordHash, role });
  } else if (role === 'store_admin') {
    const passwordHash = await bcrypt.hash('secret123', 10);
    const [user] = await db.User.findOrCreate({
      where: { email },
      defaults: {
        name: 'Store Owner',
        passwordHash,
        role: 'store_admin',
      },
    });
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
  } else {
    await request(app).post('/api/auth/register').send({
      name: 'Customer User',
      email,
      password: 'secret123',
    });
  }
  const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return login.body.token;
}

describe('Catálogo API', () => {
  beforeEach(async () => {
    await db.sequelize.query('TRUNCATE TABLE categories, stores, users CASCADE;');
    await seedCatalog();
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('GET /api/categories lista todas las categorías (público)', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.categories.length).toBe(3);
    const slugs = res.body.categories.map((c) => c.slug);
    expect(slugs).toContain('celulares');
    expect(slugs).toContain('audio');
    expect(slugs).toContain('cargadores');
  });

  test('listado con filtros: category + search + sort + paginación', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ category: 'celulares', search: 'samsung', sort: 'price_asc' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].slug).toBe('galaxy-s24');
    expect(res.body.products[0].price).toBe(1099.99);
    expect(res.body.totalPages).toBe(1);
  });

  test('sort price_desc y paginación respetan el orden', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ category: 'celulares', sort: 'price_desc', page: 1, limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(2);
    expect(res.body.total).toBe(3);
    expect(res.body.totalPages).toBe(2);
    expect(res.body.products[0].slug).toBe('iphone-15');
    expect(res.body.products[1].slug).toBe('galaxy-s24');
  });

  test('detalle de producto existente incluye categoría y precio numérico', async () => {
    const res = await request(app).get('/api/products/iphone-15');

    expect(res.status).toBe(200);
    expect(res.body.product.slug).toBe('iphone-15');
    expect(res.body.product.category.slug).toBe('celulares');
    expect(res.body.product.price).toBe(1299.99);
    expect(res.body.product.originalPrice).toBeNull();
    expect(res.body.product.store.slug).toBe('store-admin');
    expect(res.body.product.store.whatsappNumber).toBe('+541111111111');
    expect(res.body.ratingCount).toBe(0);
  });

  test('detalle de producto inexistente devuelve 404', async () => {
    const res = await request(app).get('/api/products/no-existe');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  test('crear producto sin token devuelve 401', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Cargador USB-C 20W', price: 24.99, categoryId: celularesId });

    expect(res.status).toBe(401);
  });

  test('crear producto con token de customer devuelve 403', async () => {
    const token = await tokenFor('customer@techstore.com');

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cargador USB-C 20W', price: 24.99, categoryId: celularesId });

    expect(res.status).toBe(403);
  });

  test('crear producto siendo store_admin devuelve 201, genera slug y lo liga a su tienda', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cargador USB-C 20W', price: 24.99, stock: 50, categoryId: celularesId });

    expect(res.status).toBe(201);
    expect(res.body.product.slug).toBe('cargador-usb-c-20w');
    expect(res.body.product.price).toBe(24.99);
    expect(res.body.product.categoryId).toBe(celularesId);

    const ownStore = await db.Store.findOne({ where: { slug: 'store-admin' } });
    const stored = await db.Product.findByPk(res.body.product.id);
    expect(stored.storeId).toBe(ownStore.id);
  });

  test('crear producto con original_price valido crea una oferta', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Producto con oferta',
        price: 20,
        originalPrice: 30,
        categoryId: celularesId,
      });

    expect(res.status).toBe(201);
    expect(res.body.product.originalPrice).toBe(30);
  });

  test('crear producto con original_price menor o igual a price devuelve 400', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Oferta inválida', price: 20, originalPrice: 15, categoryId: celularesId });

    expect(res.status).toBe(400);
  });

  test('actualizar producto siendo store_admin (dueño) devuelve 200', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');
    const product = await db.Product.findOne({ where: { slug: 'iphone-15' } });

    const res = await request(app)
      .put(`/api/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 1199.99 });

    expect(res.status).toBe(200);
    expect(res.body.product.price).toBe(1199.99);
  });

  test('un store_admin no puede modificar ni borrar productos de otra tienda', async () => {
    const tokenA = await tokenFor('admin@techstore.com', 'store_admin');
    const tokenB = await tokenFor('otra-tienda@techstore.com', 'store_admin');

    const product = await db.Product.findOne({ where: { slug: 'iphone-15' } });

    const update = await request(app)
      .put(`/api/products/${product.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ price: 1 });

    expect(update.status).toBe(403);
    expect(update.body.error).toContain('otra tienda');

    const del = await request(app)
      .delete(`/api/products/${product.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(del.status).toBe(403);
    expect(del.body.error).toContain('otra tienda');

    expect(await db.Product.findOne({ where: { id: product.id } })).not.toBeNull();

    const own = await request(app)
      .put(`/api/products/${product.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ price: 1099 });

    expect(own.status).toBe(200);
  });

  test('store_admin sin tienda no puede crear productos', async () => {
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
      .post('/api/products')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ name: 'Nadie', price: 9.99, categoryId: celularesId });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('tienda');
  });

  test('eliminar producto siendo store_admin (dueño) devuelve 204', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');

    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Producto Temporal', price: 9.99, categoryId: celularesId });

    const del = await request(app)
      .delete(`/api/products/${created.body.product.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(204);

    const detail = await request(app).get('/api/products/producto-temporal');
    expect(detail.status).toBe(404);
  });

  test('un producto de tienda no aprobada no aparece en el catálogo público', async () => {
    const pendingOwner = await db.User.create({
      name: 'Owner Pendiente',
      email: 'pendiente@techstore.com',
      passwordHash: await bcrypt.hash('secret123', 10),
      role: 'store_admin',
    });
    const pendingStore = await db.Store.create({
      name: 'Tienda Pendiente',
      slug: 'tienda-pendiente',
      ownerUserId: pendingOwner.id,
      status: 'pending',
    });
    const category = await db.Category.findOne({ where: { slug: 'audio' } });
    await db.Product.create({
      name: 'Producto Invisible',
      slug: 'producto-invisible',
      price: 100,
      stock: 5,
      categoryId: category.id,
      storeId: pendingStore.id,
    });

    const res = await request(app).get('/api/products').query({ search: 'invisible' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);

    const detail = await request(app).get('/api/products/producto-invisible');
    expect(detail.status).toBe(404);
  });

  test('borrar categoría con productos asociados devuelve 409 con mensaje claro', async () => {
    const token = await tokenFor('platform-admin@techstore.com', 'admin');

    const res = await request(app)
      .delete(`/api/categories/${celularesId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('No se puede eliminar la categoría');
    expect(res.body.error).toContain('producto');
  });

  test('borrar categoría sin productos devuelve 204', async () => {
    const token = await tokenFor('platform-admin@techstore.com', 'admin');
    const category = await db.Category.create({ name: 'Vacía', slug: 'vacia' });

    const res = await request(app)
      .delete(`/api/categories/${category.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  test('detalle calcula isNew y discountPercent y expone priceHistory', async () => {
    const category = await db.Category.findOne({ where: { slug: 'celulares' } });
    const store = await db.Store.findOne({ where: { slug: 'store-admin' } });

    await db.Product.create({
      name: 'Producto Viejo',
      slug: 'producto-viejo',
      description: 'Viejo sin oferta',
      price: 50,
      stock: 5,
      categoryId: category.id,
      storeId: store.id,
      createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    });

    await db.Product.create({
      name: 'Producto Oferta Reciente',
      slug: 'producto-oferta-reciente',
      description: 'Oferta reciente',
      price: 20,
      originalPrice: 30,
      stock: 5,
      categoryId: category.id,
      storeId: store.id,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    const oldRes = await request(app).get('/api/products/producto-viejo');
    expect(oldRes.status).toBe(200);
    expect(oldRes.body.product.isNew).toBe(false);
    expect(oldRes.body.product.discountPercent).toBeNull();
    expect(oldRes.body.product.priceHistory).toEqual([]);

    const offerRes = await request(app).get('/api/products/producto-oferta-reciente');
    expect(offerRes.status).toBe(200);
    expect(offerRes.body.product.isNew).toBe(true);
    expect(offerRes.body.product.discountPercent).toBe(33);
    expect(offerRes.body.product.priceHistory).toEqual([]);
  });

  test('el historial de precios se registra al cambiar price y no al cambiar solo stock', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');
    const product = await db.Product.findOne({ where: { slug: 'iphone-15' } });

    const changePrice = await request(app)
      .put(`/api/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 1099.99 });

    expect(changePrice.status).toBe(200);
    expect(changePrice.body.product.price).toBe(1099.99);

    const firstDetail = await request(app).get('/api/products/iphone-15');
    expect(firstDetail.body.product.priceHistory).toHaveLength(1);
    expect(firstDetail.body.product.priceHistory[0].price).toBe(1299.99);
    expect(firstDetail.body.product.priceHistory[0].changedAt).toBeTruthy();

    const onlyStock = await request(app)
      .put(`/api/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stock: 7 });

    expect(onlyStock.status).toBe(200);

    const secondDetail = await request(app).get('/api/products/iphone-15');
    expect(secondDetail.body.product.priceHistory).toHaveLength(1);
  });

  test('GET /api/products?onSale=true filtra solo productos con original_price > price', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');

    const offer = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Oferta del filtro', price: 60, originalPrice: 100, categoryId: celularesId });

    expect(offer.status).toBe(201);

    const res = await request(app).get('/api/products').query({ onSale: 'true' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].slug).toBe('oferta-del-filtro');
    expect(res.body.products[0].originalPrice).toBe(100);
    expect(res.body.products[0].price).toBe(60);

    expect(res.body.products.some((p) => p.slug === 'iphone-15')).toBe(false);
  });
});
