import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';

let storeA;
let storeB;
let productOfA;
let productOfB;

async function seedStores() {
  const [userA, userB] = await db.User.bulkCreate(
    [
      {
        name: 'Dueño Tienda A',
        email: 'owner-a@techstore.com',
        passwordHash: await bcrypt.hash('secret123', 10),
        role: 'store_admin',
      },
      {
        name: 'Dueño Tienda B',
        email: 'owner-b@techstore.com',
        passwordHash: await bcrypt.hash('secret123', 10),
        role: 'store_admin',
      },
    ],
    { returning: true },
  );

  [storeA, storeB] = await db.Store.bulkCreate(
    [
      {
        name: 'Tienda A',
        slug: 'tienda-a',
        whatsappNumber: '+5491111111111',
        ownerUserId: userA.id,
        status: 'approved',
      },
      {
        name: 'Tienda B',
        slug: 'tienda-b',
        whatsappNumber: '+5491222222222',
        ownerUserId: userB.id,
        status: 'approved',
      },
    ],
    { returning: true },
  );

  const categories = await db.Category.bulkCreate(
    [
      { name: 'Celulares', slug: 'celulares', storeId: storeA.id },
      { name: 'Audio', slug: 'audio', storeId: storeB.id },
    ],
    { returning: true },
  );
  const [celulares, audio] = categories;

  [productOfA, productOfB] = await db.Product.bulkCreate(
    [
      {
        name: 'Producto A',
        slug: 'prod-a',
        price: 100,
        stock: 10,
        categoryId: celulares.id,
        storeId: storeA.id,
      },
      {
        name: 'Producto B',
        slug: 'prod-b',
        price: 200,
        stock: 10,
        categoryId: audio.id,
        storeId: storeB.id,
      },
    ],
    { returning: true },
  );
}

async function storeAdminToken(email) {
  const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return login.body.token;
}

async function customerToken(email) {
  await request(app).post('/api/auth/register').send({
    name: 'Cliente',
    email,
    password: 'secret123',
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return login.body.token;
}

async function createOrder(customerTokenValue, productId, quantity = 1) {
  const res = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${customerTokenValue}`)
    .send({ items: [{ product_id: productId, quantity }] });
  return res.body.order;
}

describe('Store Admin Orders API (pedidos de la propia tienda)', () => {
  beforeEach(async () => {
    await db.sequelize.query('TRUNCATE TABLE categories, stores, users CASCADE;');
    await seedStores();
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('customer no puede usar los endpoints de pedidos de tienda', async () => {
    const token = await customerToken('cliente@techstore.com');

    const list = await request(app)
      .get('/api/store-admin/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(403);

    const update = await request(app)
      .put(`/api/store-admin/orders/${productOfA.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'confirmed' });
    expect(update.status).toBe(403);
  });

  test('store_admin ve solo los pedidos de su propia tienda, no los de la otra', async () => {
    const tokenA = await customerToken('cliente-a@techstore.com');
    const tokenB = await customerToken('cliente-b@techstore.com');
    const orderOfA = await createOrder(tokenA, productOfA.id);
    const orderOfB = await createOrder(tokenB, productOfB.id);

    const tokenAdminA = await storeAdminToken('owner-a@techstore.com');
    const list = await request(app)
      .get('/api/store-admin/orders')
      .set('Authorization', `Bearer ${tokenAdminA}`);

    expect(list.status).toBe(200);
    expect(list.body.orders).toHaveLength(1);
    expect(list.body.orders[0].id).toBe(orderOfA.id);
    expect(list.body.orders.map((order) => order.id)).not.toContain(orderOfB.id);
  });

  test('store_admin ve pedidos sin cuenta (venta por asistente) y con cliente logueado', async () => {
    const tokenCustomer = await customerToken('cliente@techstore.com');
    await createOrder(tokenCustomer, productOfA.id);

    const amount = 2;
    const guestOrder = await db.Order.create({
      userId: null,
      customerName: 'Compra Sin Cuenta',
      customerContact: '+5491100000000',
      status: 'confirmed',
      total: Number(productOfA.price) * amount,
    });
    await db.OrderItem.create({
      orderId: guestOrder.id,
      productId: productOfA.id,
      quantity: amount,
      unitPrice: productOfA.price,
    });

    const list = await request(app)
      .get('/api/store-admin/orders')
      .set('Authorization', `Bearer ${await storeAdminToken('owner-a@techstore.com')}`);

    expect(list.status).toBe(200);
    const ids = list.body.orders.map((order) => order.id);
    expect(ids).toContain(guestOrder.id);
  });

  test('filtro por status en el listado de la propia tienda', async () => {
    const tokenA = await customerToken('cliente-a@techstore.com');
    const tokenAdminA = await storeAdminToken('owner-a@techstore.com');

    const first = await createOrder(tokenA, productOfA.id);
    const second = await createOrder(tokenA, productOfA.id);

    await request(app)
      .put(`/api/store-admin/orders/${first.id}/status`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ status: 'confirmed' });

    const pending = await request(app)
      .get('/api/store-admin/orders?status=pending')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(pending.status).toBe(200);
    expect(pending.body.orders.map((order) => order.id)).toEqual([second.id]);

    const confirmed = await request(app)
      .get('/api/store-admin/orders?status=confirmed')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(confirmed.body.orders.map((order) => order.id)).toEqual([first.id]);

    const invalido = await request(app)
      .get('/api/store-admin/orders?status=hola')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(invalido.status).toBe(400);
  });

  test('store_admin puede ver y gestionar un pedido propio, pero no el de otra tienda', async () => {
    const tokenA = await customerToken('cliente-a@techstore.com');
    const tokenB = await customerToken('cliente-b@techstore.com');
    const orderOfA = await createOrder(tokenA, productOfA.id);
    const orderOfB = await createOrder(tokenB, productOfB.id);

    const tokenAdminA = await storeAdminToken('owner-a@techstore.com');

    const detail = await request(app)
      .get(`/api/store-admin/orders/${orderOfA.id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(detail.status).toBe(200);
    expect(detail.body.order.id).toBe(orderOfA.id);

    const detailOtro = await request(app)
      .get(`/api/store-admin/orders/${orderOfB.id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(detailOtro.status).toBe(404);

    const verOtroUpdate = await request(app)
      .put(`/api/store-admin/orders/${orderOfB.id}/status`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ status: 'confirmed' });
    expect(verOtroUpdate.status).toBe(403);
    expect(await db.Order.findByPk(orderOfB.id).then((order) => order.status)).toBe('pending');
  });

  test('store_admin cancela un pedido propio y devuelve el stock', async () => {
    const tokenA = await customerToken('cliente-a@techstore.com');
    const order = await createOrder(tokenA, productOfA.id, 3);
    const tokenAdminA = await storeAdminToken('owner-a@techstore.com');

    expect(await db.Product.findByPk(productOfA.id).then((p) => p.stock)).toBe(7);

    const cancel = await request(app)
      .put(`/api/store-admin/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ status: 'cancelled' });

    expect(cancel.status).toBe(200);
    expect(cancel.body.order.status).toBe('cancelled');
    expect(await db.Product.findByPk(productOfA.id).then((p) => p.stock)).toBe(10);
  });
});
