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
      { name: 'Celulares', slug: 'celulares', storeId: store.id },
      { name: 'Audio', slug: 'audio', storeId: store.id },
      { name: 'Cargadores', slug: 'cargadores', storeId: store.id },
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

  test('GET /api/categories lista los nombres de categoría del marketplace (público)', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    const names = res.body.categories.map((c) => c.name);
    expect(names).toEqual(['Audio', 'Cargadores', 'Celulares']);
    // El listado público es sólo de nombres: las categorías son privadas por tienda.
    expect(res.body.categories[0].slug).toBeUndefined();
  });

  test('el filtro global de categoría matchea por nombre, no por slug', async () => {
    const byName = await request(app).get('/api/products').query({ category: 'celulares' });

    expect(byName.status).toBe(200);
    expect(byName.body.total).toBe(3);

    const unknown = await request(app).get('/api/products').query({ category: 'NoExiste' });

    expect(unknown.status).toBe(200);
    expect(unknown.body.total).toBe(0);
  });

  test('listado con filtros: category + search + sort + paginación', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ category: 'Celulares', search: 'samsung', sort: 'price_asc' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].slug).toBe('galaxy-s24');
    expect(res.body.products[0].price).toBe(1099.99);
    expect(res.body.totalPages).toBe(1);
  });

  test('sort price_desc y paginación respetan el orden', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ category: 'Celulares', sort: 'price_desc', page: 1, limit: 2 });

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

  test('crear producto con costo: se guarda y se devuelve en la respuesta', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Producto con costo', price: 50, cost: 32.5, categoryId: celularesId });

    expect(res.status).toBe(201);
    expect(res.body.product.cost).toBe(32.5);

    const stored = await db.Product.findByPk(res.body.product.id);
    expect(Number(stored.cost)).toBe(32.5);
  });

  test('crear producto sin costo devuelve costo 0 por defecto', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Producto sin costo', price: 40, categoryId: celularesId });

    expect(res.status).toBe(201);
    expect(res.body.product.cost).toBe(0);
  });

  test('crear producto con costo negativo devuelve 400', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Costo inválido', price: 40, cost: -5, categoryId: celularesId });

    expect(res.status).toBe(400);
  });

  test('actualizar el costo de un producto existente', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');
    const product = await db.Product.findOne({ where: { slug: 'iphone-15' } });

    const res = await request(app)
      .put(`/api/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cost: 999 });

    expect(res.status).toBe(200);
    expect(res.body.product.cost).toBe(999);
    expect(Number((await db.Product.findByPk(product.id)).cost)).toBe(999);
  });

  test('el costo no se expone en el catálogo público ni en el detalle', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');
    await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Producto con costo secreto', price: 40, cost: 10, categoryId: celularesId });

    const list = await request(app).get('/api/products').query({ search: 'secreto' });
    expect(list.status).toBe(200);
    expect(list.body.products[0].cost).toBeUndefined();

    const detail = await request(app).get('/api/products/producto-con-costo-secreto');
    expect(detail.status).toBe(200);
    expect(detail.body.product.cost).toBeUndefined();
  });

  test('el panel del store_admin sí expone el costo', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Costo en panel', price: 40, cost: 12, categoryId: celularesId });

    const panel = await request(app)
      .get('/api/store-admin/products')
      .set('Authorization', `Bearer ${token}`);

    expect(panel.status).toBe(200);
    const row = panel.body.products.find((p) => p.id === created.body.product.id);
    expect(row.cost).toBe(12);
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

  test('eliminar producto lo marca inactivo sin borrar la fila: desaparece del catálogo público y se puede reactivar', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');

    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Producto Temporal', price: 9.99, categoryId: celularesId });

    const del = await request(app)
      .delete(`/api/products/${created.body.product.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(204);

    const row = await db.Product.findByPk(created.body.product.id);
    expect(row).not.toBeNull();
    expect(row.isActive).toBe(false);

    const detail = await request(app).get('/api/products/producto-temporal');
    expect(detail.status).toBe(404);

    const list = await request(app).get('/api/products').query({ search: 'temporal' });
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(0);

    const storeList = await request(app)
      .get('/api/stores/store-admin/products')
      .query({ search: 'temporal' });
    expect(storeList.body.products).toEqual([]);

    const reactivate = await request(app)
      .put(`/api/products/${created.body.product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true });

    expect(reactivate.status).toBe(200);
    expect(reactivate.body.product.isActive).toBe(true);

    const back = await request(app).get('/api/products/producto-temporal');
    expect(back.status).toBe(200);
    expect(back.body.product.isActive).toBe(true);
  });

  test('el panel del store_admin sigue mostrando los productos inactivos', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');

    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inactivo En Panel', price: 15, categoryId: celularesId });

    await request(app)
      .delete(`/api/products/${created.body.product.id}`)
      .set('Authorization', `Bearer ${token}`);

    const panel = await request(app)
      .get('/api/store-admin/products')
      .set('Authorization', `Bearer ${token}`);

    expect(panel.status).toBe(200);
    const inactive = panel.body.products.find((p) => p.id === created.body.product.id);
    expect(inactive).toBeTruthy();
    expect(inactive.isActive).toBe(false);
  });

  test('un pedido antiguo conserva sus datos íntegros cuando el producto se desactiva después', async () => {
    const customerToken = await tokenFor('cliente-is@techstore.com');
    const ownerToken = await tokenFor('admin@techstore.com', 'store_admin');
    const product = await db.Product.findOne({ where: { slug: 'iphone-15' } });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ product_id: product.id, quantity: 2 }] });

    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.order.id;
    const placedItem = orderRes.body.order.items.find((i) => i.productId === product.id);
    expect(Number(placedItem.unitPrice)).toBe(1299.99);

    const del = await request(app)
      .delete(`/api/products/${product.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(del.status).toBe(204);
    expect((await db.Product.findByPk(product.id)).isActive).toBe(false);

    const detail = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(detail.status).toBe(200);
    const kept = detail.body.order.items.find((i) => i.productId === product.id);
    expect(kept.productId).toBe(product.id);
    expect(Number(kept.unitPrice)).toBe(1299.99);
    expect(kept.quantity).toBe(2);

    const row = await db.Product.findByPk(product.id);
    expect(row).not.toBeNull();
    expect(row.name).toBe('iPhone 15');
    expect(row.isActive).toBe(false);
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

  test('detalle calcula isNew y discountPercent y expone priceHistory', async () => {
    const store = await db.Store.findOne({ where: { slug: 'store-admin' } });
    const category = await db.Category.findOne({
      where: { slug: 'celulares', storeId: store.id },
    });

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

  test('el catálogo mezcla productos de todas las tiendas aprobadas y devuelve 0 para una categoría vacía', async () => {
    const secondOwner = await db.User.create({
      name: 'Second Owner',
      email: 'second@techstore.com',
      passwordHash: await bcrypt.hash('secret123', 10),
      role: 'store_admin',
    });
    const secondStore = await db.Store.create({
      name: 'Segunda Tienda',
      slug: 'segunda-tienda',
      whatsappNumber: '+541122223333',
      ownerUserId: secondOwner.id,
      status: 'approved',
    });
    const secondCategory = await db.Category.create({
      name: 'Celulares',
      slug: 'celulares',
      storeId: secondStore.id,
    });
    await db.Product.create({
      name: 'Motorola Edge 50',
      slug: 'motorola-edge-50',
      description: 'De otra tienda aprobada',
      price: 799.99,
      stock: 12,
      categoryId: secondCategory.id,
      storeId: secondStore.id,
    });

    const mixed = await request(app).get('/api/products');

    expect(mixed.status).toBe(200);
    expect(mixed.body.total).toBe(6);
    const slugs = mixed.body.products.map((p) => p.slug);
    expect(slugs).toContain('iphone-15');
    expect(slugs).toContain('motorola-edge-50');
    const owners = new Set(mixed.body.products.map((p) => p.store.name));
    expect(owners).toEqual(new Set(['Tienda Catálogo', 'Segunda Tienda']));

    // Mismo nombre de categoría en dos tiendas: el filtro global trae ambos.
    const shared = await request(app).get('/api/products').query({ category: 'Celulares' });

    expect(shared.status).toBe(200);
    expect(shared.body.total).toBe(4);
    expect(shared.body.products.map((p) => p.slug)).toContain('motorola-edge-50');

    // El catálogo de una tienda resuelve el slug dentro de esa misma tienda.
    const scoped = await request(app)
      .get('/api/products')
      .query({ store: 'segunda-tienda', category: 'celulares' });

    expect(scoped.status).toBe(200);
    expect(scoped.body.total).toBe(1);
    expect(scoped.body.products[0].slug).toBe('motorola-edge-50');

    const empty = await request(app).get('/api/products').query({ category: 'Cargadores' });

    expect(empty.status).toBe(200);
    expect(empty.body.total).toBe(0);
    expect(empty.body.products).toEqual([]);
  });

  test('crear un producto con la categoría de otra tienda devuelve 400', async () => {
    const token = await tokenFor('admin@techstore.com', 'store_admin');
    const store = await db.Store.findOne({ where: { slug: 'store-admin' } });
    const otherOwner = await db.User.create({
      name: 'Other Owner',
      email: 'other-owner@techstore.com',
      passwordHash: await bcrypt.hash('secret123', 10),
      role: 'store_admin',
    });
    const otherStore = await db.Store.create({
      name: 'Otra Tienda',
      slug: 'otra-tienda',
      whatsappNumber: '+541144443333',
      ownerUserId: otherOwner.id,
      status: 'approved',
    });
    const other = await db.Category.create({
      name: 'Robots',
      slug: 'robots',
      storeId: otherStore.id,
    });

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Producto Ajeno', price: 10, categoryId: other.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('no pertenece a tu tienda');
    expect(await db.Product.findOne({ where: { slug: 'producto-ajeno' } })).toBeNull();
    expect(store.id).not.toBe(otherStore.id);
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
