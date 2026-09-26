import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';

let productId;

async function seedCatalog() {
  const storeAdmin = await db.User.create({
    name: 'Store Owner',
    email: 'reviews-store@techstore.com',
    passwordHash: await bcrypt.hash('secret123', 10),
    role: 'store_admin',
  });
  const store = await db.Store.create({
    name: 'Tienda Reseñas',
    slug: 'tienda-resenas',
    whatsappNumber: '+541111111111',
    ownerUserId: storeAdmin.id,
    status: 'approved',
  });

  const categories = await db.Category.bulkCreate([{ name: 'Celulares', slug: 'celulares' }], {
    returning: true,
  });
  const [product] = await db.Product.bulkCreate(
    [
      {
        name: 'iPhone 15',
        slug: 'iphone-15',
        price: 1000,
        stock: 10,
        categoryId: categories[0].id,
        storeId: store.id,
      },
    ],
    { returning: true },
  );
  productId = product.id;
}

async function tokenFor(email, role = 'customer') {
  if (role === 'admin') {
    const passwordHash = await bcrypt.hash('secret123', 10);
    await db.User.create({ name: 'Admin User', email, passwordHash, role: 'admin' });
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

async function buyProductAs(token, status = 'confirmed', adminToken = null) {
  const created = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ items: [{ product_id: productId, quantity: 1 }] });

  const resolvedAdminToken = adminToken ?? (await tokenFor('admin@techstore.com', 'admin'));
  const update = await request(app)
    .put(`/api/admin/orders/${created.body.order.id}/status`)
    .set('Authorization', `Bearer ${resolvedAdminToken}`)
    .send({ status });

  return { order: created.body.order, update: update.body.order };
}

async function registerGuestPurchase(status = 'confirmed') {
  const product = await db.Product.findByPk(productId);
  const order = await db.Order.create({
    userId: null,
    status,
    total: Number(product.price),
  });
  await db.OrderItem.create({
    orderId: order.id,
    productId,
    quantity: 1,
    unitPrice: Number(product.price),
  });
  return order;
}

describe('Reviews API', () => {
  beforeEach(async () => {
    await db.sequelize.query('TRUNCATE TABLE categories, stores, users CASCADE;');
    await seedCatalog();
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('reseña exitosa de un producto comprado (confirmado)', async () => {
    const token = await tokenFor('cliente@techstore.com');
    await buyProductAs(token);

    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, comment: 'Excelente teléfono' });

    expect(res.status).toBe(201);
    expect(res.body.review.rating).toBe(5);
    expect(res.body.review.comment).toBe('Excelente teléfono');
    expect(res.body.review.user.name).toBe('Customer User');
    expect(res.body.review.user).not.toHaveProperty('email');
  });

  test('el detalle del producto refleja promedio y conteo de reseñas', async () => {
    const token = await tokenFor('cliente@techstore.com');
    const adminToken = await tokenFor('admin@techstore.com', 'admin');
    await buyProductAs(token, 'confirmed', adminToken);

    await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 4, comment: 'Muy bueno' });

    const otroToken = await tokenFor('otro@techstore.com');
    await buyProductAs(otroToken, 'confirmed', adminToken);
    await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${otroToken}`)
      .send({ rating: 2 });

    const detail = await request(app).get('/api/products/iphone-15');

    expect(detail.status).toBe(200);
    expect(detail.body.ratingCount).toBe(2);
    expect(detail.body.ratingAverage).toBe(3);

    const list = await request(app).get(`/api/products/${productId}/reviews`);
    expect(list.status).toBe(200);
    expect(list.body.ratingCount).toBe(2);
    expect(list.body.reviews.length).toBe(2);
    expect(list.body.reviews.every((r) => r.user && typeof r.user.name === 'string')).toBe(true);
  });

  test('intento de reseña sin haber comprado devuelve 403', async () => {
    const token = await tokenFor('cliente@techstore.com');

    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, comment: 'No compré esto' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('comprado');
  });

  test('un pedido en status pending no habilita a reseñar', async () => {
    const token = await tokenFor('cliente@techstore.com');
    await buyProductAs(token, 'pending');

    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5 });

    expect(res.status).toBe(403);
  });

  test('intento de reseña duplicada devuelve 409', async () => {
    const token = await tokenFor('cliente@techstore.com');
    await buyProductAs(token);

    const first = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, comment: 'Primera reseña' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 1, comment: 'Segunda reseña' });

    expect(second.status).toBe(409);
    expect(second.body.error).toContain('Ya reseñaste');
  });

  test('reseña de producto inexistente devuelve 404', async () => {
    const token = await tokenFor('cliente@techstore.com');

    const res = await request(app)
      .post('/api/products/999999/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5 });

    expect(res.status).toBe(404);
  });

  test('rating fuera de rango devuelve 400', async () => {
    const token = await tokenFor('cliente@techstore.com');
    await buyProductAs(token);

    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 7 });

    expect(res.status).toBe(400);
  });

  test('listar reseñas de producto inexistente devuelve 404', async () => {
    const res = await request(app).get('/api/products/999999/reviews');
    expect(res.status).toBe(404);
  });

  test('un pedido sin user_id (venta a cliente sin cuenta) no puede reseñarse desde ninguna cuenta', async () => {
    await registerGuestPurchase('confirmed');

    const tokenA = await tokenFor('cliente-guest-a@techstore.com');
    const resA = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ rating: 5, comment: 'Quiero aprovechar la venta' });
    expect(resA.status).toBe(403);

    const tokenB = await tokenFor('cliente-guest-b@techstore.com');
    const resB = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ rating: 4 });
    expect(resB.status).toBe(403);

    const reviews = await request(app).get(`/api/products/${productId}/reviews`);
    expect(reviews.status).toBe(200);
    expect(reviews.body.ratingCount).toBe(0);
  });
});
