import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';

let productA;
let productB;

async function seedCatalog() {
  const categories = await db.Category.bulkCreate(
    [
      { name: 'Celulares', slug: 'celulares' },
      { name: 'Audio', slug: 'audio' },
    ],
    { returning: true },
  );
  const [celulares, audio] = categories;

  [productA] = await db.Product.bulkCreate(
    [
      { name: 'iPhone 15', slug: 'iphone-15', price: 1000, stock: 5, categoryId: celulares.id },
      {
        name: 'Sony WH-1000XM5',
        slug: 'sony-wh-1000xm5',
        price: 400,
        stock: 3,
        categoryId: audio.id,
      },
      { name: 'AirPods Pro 2', slug: 'airpods-pro-2', price: 280, stock: 2, categoryId: audio.id },
    ],
    { returning: true },
  );
  productB = await db.Product.findOne({ where: { slug: 'sony-wh-1000xm5' } });
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

async function stockOf(slug) {
  const product = await db.Product.findOne({ where: { slug } });
  return product.stock;
}

describe('Orders API', () => {
  beforeEach(async () => {
    await db.sequelize.query('TRUNCATE TABLE categories, users CASCADE;');
    await seedCatalog();
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('crear pedido sin token devuelve 401', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ product_id: productA.id, quantity: 1 }] });

    expect(res.status).toBe(401);
  });

  test('creación exitosa descuenta stock y guarda unit_price del momento', async () => {
    const token = await tokenFor('cliente@techstore.com');

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { product_id: productA.id, quantity: 2 },
          { product_id: productB.id, quantity: 1 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('pending');
    expect(res.body.order.total).toBe(2400);
    expect(res.body.order.items.length).toBe(2);

    const itemA = res.body.order.items.find((i) => i.productId === productA.id);
    expect(itemA.unitPrice).toBe(1000);
    expect(itemA.quantity).toBe(2);

    expect(await stockOf('iphone-15')).toBe(3);
    expect(await stockOf('sony-wh-1000xm5')).toBe(2);

    // unit_price queda congelado aunque el precio cambie después
    await db.Product.update({ price: 1100 }, { where: { id: productA.id } });
    const second = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product_id: productA.id, quantity: 1 }] });

    expect(second.status).toBe(201);
    expect(second.body.order.items[0].unitPrice).toBe(1100);
    const first = db.OrderItem.findOne({
      where: { productId: productA.id, orderId: res.body.order.id },
    });
    expect(Number((await first).unitPrice)).toBe(1000);
  });

  test('stock insuficiente: falla con 409 y no crea pedido ni descuenta stock', async () => {
    const token = await tokenFor('cliente@techstore.com');

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product_id: productA.id, quantity: 99 }] });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Stock insuficiente');
    expect(res.body.error).toContain('iPhone 15');

    expect(await stockOf('iphone-15')).toBe(5);
    const orderCount = await db.Order.count();
    expect(orderCount).toBe(0);
  });

  test('un usuario no puede ver pedidos de otro usuario', async () => {
    const tokenA = await tokenFor('usuario-a@techstore.com');
    const tokenB = await tokenFor('usuario-b@techstore.com');

    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ items: [{ product_id: productA.id, quantity: 1 }] });

    const orderId = created.body.order.id;

    const forbidden = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(forbidden.status).toBe(403);

    const ownList = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenB}`);

    expect(ownList.status).toBe(200);
    expect(ownList.body.orders.length).toBe(0);
  });

  test('admin puede ver el pedido de otro usuario', async () => {
    const tokenA = await tokenFor('usuario-a@techstore.com');
    const tokenAdmin = await tokenFor('admin@techstore.com', 'admin');

    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ items: [{ product_id: productA.id, quantity: 1 }] });

    const res = await request(app)
      .get(`/api/orders/${created.body.order.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(created.body.order.id);
  });

  test('admin lista todos los pedidos y filtra por status', async () => {
    const token = await tokenFor('usuario-a@techstore.com');
    const tokenAdmin = await tokenFor('admin@techstore.com', 'admin');

    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product_id: productA.id, quantity: 1 }] });
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product_id: productB.id, quantity: 1 }] });

    const all = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(all.status).toBe(200);
    expect(all.body.orders.length).toBe(2);

    await request(app)
      .put(`/api/admin/orders/${all.body.orders[0].id}/status`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ status: 'confirmed' });

    const pending = await request(app)
      .get('/api/admin/orders?status=pending')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(pending.status).toBe(200);
    expect(pending.body.orders.length).toBe(1);
    expect(pending.body.orders[0].status).toBe('pending');
  });

  test('cambio de status inválido devuelve 400', async () => {
    const token = await tokenFor('usuario-a@techstore.com');
    const tokenAdmin = await tokenFor('admin@techstore.com', 'admin');

    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product_id: productA.id, quantity: 1 }] });

    const res = await request(app)
      .put(`/api/admin/orders/${created.body.order.id}/status`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ status: 'shipped' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('pending');
  });

  test('cancelación de pedido devuelve el stock descontado', async () => {
    const token = await tokenFor('usuario-a@techstore.com');
    const tokenAdmin = await tokenFor('admin@techstore.com', 'admin');

    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { product_id: productA.id, quantity: 2 },
          { product_id: productB.id, quantity: 1 },
        ],
      });

    expect(await stockOf('iphone-15')).toBe(3);
    expect(await stockOf('sony-wh-1000xm5')).toBe(2);

    const confirm = await request(app)
      .put(`/api/admin/orders/${created.body.order.id}/status`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ status: 'confirmed' });
    expect(confirm.status).toBe(200);
    expect(confirm.body.order.status).toBe('confirmed');

    const cancel = await request(app)
      .put(`/api/admin/orders/${created.body.order.id}/status`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ status: 'cancelled' });

    expect(cancel.status).toBe(200);
    expect(cancel.body.order.status).toBe('cancelled');
    expect(await stockOf('iphone-15')).toBe(5);
    expect(await stockOf('sony-wh-1000xm5')).toBe(3);
  });
});
