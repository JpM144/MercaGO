import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';
import { getTopProductsWindow } from '../controllers/reports.controller.js';

let storeA;
let storeB;
let productA1;
let productA2;
let productB1;

async function seedStores() {
  const passwordHash = await bcrypt.hash('secret123', 10);
  const [userA, userB] = await db.User.bulkCreate(
    [
      { name: 'Owner A', email: 'rep-owner-a@techstore.com', passwordHash, role: 'store_admin' },
      { name: 'Owner B', email: 'rep-owner-b@techstore.com', passwordHash, role: 'store_admin' },
    ],
    { returning: true },
  );

  [storeA, storeB] = await db.Store.bulkCreate(
    [
      {
        name: 'Reportes A',
        slug: 'reportes-a',
        whatsappNumber: '+541111111111',
        ownerUserId: userA.id,
        status: 'approved',
      },
      {
        name: 'Reportes B',
        slug: 'reportes-b',
        whatsappNumber: '+542222222222',
        ownerUserId: userB.id,
        status: 'approved',
      },
    ],
    { returning: true },
  );

  // Cada tienda tiene su propia copia de la categoría "Reportes" (mismo nombre y slug).
  const categories = await db.Category.bulkCreate(
    [
      { name: 'Reportes', slug: 'reportes', storeId: storeA.id },
      { name: 'Reportes', slug: 'reportes', storeId: storeB.id },
    ],
    { returning: true },
  );
  const [categoryA, categoryB] = categories;

  [productA1, productA2, productB1] = await db.Product.bulkCreate(
    [
      { name: 'Prod A1', slug: 'prod-a1', price: 100, cost: 60, stock: 50, categoryId: categoryA.id, storeId: storeA.id },
      { name: 'Prod A2', slug: 'prod-a2', price: 50, cost: 30, stock: 50, categoryId: categoryA.id, storeId: storeA.id },
      { name: 'Prod B1', slug: 'prod-b1', price: 200, cost: 150, stock: 50, categoryId: categoryB.id, storeId: storeB.id },
    ],
    { returning: true },
  );
}

async function storeAdminToken(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return res.body.token;
}

async function createOrderAt(date, items) {
  const total = items.reduce(
    (sum, item) => sum + Math.round(item.unitPrice * item.quantity * 100) / 100,
    0,
  );
  const order = await db.Order.create({
    userId: null,
    status: 'confirmed',
    total,
    createdAt: date,
  });
  for (const item of items) {
    await db.OrderItem.create({
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
    });
  }
  return order;
}

describe('Store Reports API (informes del store_admin)', () => {
  beforeEach(async () => {
    await db.sequelize.query('TRUNCATE TABLE categories, stores, users CASCADE;');
    await seedStores();
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('customer no puede usar los informes (403) y el period inválido da 400', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Cliente',
      email: 'rep-cliente@techstore.com',
      password: 'secret123',
    });
    const login = await request(app).post('/api/auth/login').send({
      email: 'rep-cliente@techstore.com',
      password: 'secret123',
    });

    const reports = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${login.body.token}`)
      .query({ period: 'daily', date: '2026-09-10' });
    expect(reports.status).toBe(403);

    const badPeriod = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${await storeAdminToken('rep-owner-a@techstore.com')}`)
      .query({ period: 'anual', date: '2026-09-10' });
    expect(badPeriod.status).toBe(400);

    const badDate = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${await storeAdminToken('rep-owner-a@techstore.com')}`)
      .query({ period: 'daily', date: 'no-es-una-fecha' });
    expect(badDate.status).toBe(400);
  });

  test('informe diario: ganancia = sum((unit_price - unit_cost) * quantity) por producto y totales', async () => {
    await createOrderAt(new Date(Date.UTC(2026, 8, 10, 15, 0, 0)), [
      { productId: productA1.id, quantity: 2, unitPrice: 100, unitCost: 60 },
      { productId: productA2.id, quantity: 1, unitPrice: 50, unitCost: 30 },
    ]);

    const res = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${await storeAdminToken('rep-owner-a@techstore.com')}`)
      .query({ period: 'daily', date: '2026-09-10' });

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('daily');
    expect(res.body.totals).toEqual({
      orders: 1,
      items: 2,
      quantity: 3,
      revenue: 250,
      cost: 150,
      profit: 100,
    });
    expect(res.body.products).toHaveLength(2);

    const a1 = res.body.products.find((p) => p.productId === productA1.id);
    const a2 = res.body.products.find((p) => p.productId === productA2.id);
    expect(a1).toMatchObject({ name: 'Prod A1', quantity: 2, revenue: 200, cost: 120, profit: 80 });
    expect(a2).toMatchObject({ name: 'Prod A2', quantity: 1, revenue: 50, cost: 30, profit: 20 });
  });

  test('período sin ventas devuelve listas vacías y totales en cero', async () => {
    const res = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${await storeAdminToken('rep-owner-a@techstore.com')}`)
      .query({ period: 'daily', date: '2026-01-05' });

    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
    expect(res.body.totals).toEqual({ orders: 0, items: 0, quantity: 0, revenue: 0, cost: 0, profit: 0 });
  });

  test('aislamiento entre tiendas: cada store_admin solo ve sus ventas', async () => {
    await createOrderAt(new Date(Date.UTC(2026, 8, 10, 15, 0, 0)), [
      { productId: productA1.id, quantity: 1, unitPrice: 100, unitCost: 60 },
    ]);
    await createOrderAt(new Date(Date.UTC(2026, 8, 10, 16, 0, 0)), [
      { productId: productB1.id, quantity: 3, unitPrice: 200, unitCost: 150 },
    ]);

    const tokenA = await storeAdminToken('rep-owner-a@techstore.com');
    const tokenB = await storeAdminToken('rep-owner-b@techstore.com');

    const reportA = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ period: 'daily', date: '2026-09-10' });
    expect(reportA.status).toBe(200);
    expect(reportA.body.products.map((p) => p.productId)).toEqual([productA1.id]);
    expect(reportA.body.totals.profit).toBe(40);

    const reportB = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${tokenB}`)
      .query({ period: 'daily', date: '2026-09-10' });
    expect(reportB.body.products.map((p) => p.productId)).toEqual([productB1.id]);
    expect(reportB.body.totals).toMatchObject({ quantity: 3, revenue: 600, cost: 450, profit: 150 });
  });

  test('informe semanal: la semana que contiene la fecha (lunes a domingo)', async () => {
    await createOrderAt(new Date(Date.UTC(2026, 8, 9, 15, 0, 0)), [
      { productId: productA1.id, quantity: 1, unitPrice: 100, unitCost: 60 },
    ]);
    await createOrderAt(new Date(Date.UTC(2026, 8, 12, 15, 0, 0)), [
      { productId: productA1.id, quantity: 1, unitPrice: 100, unitCost: 60 },
    ]);
    await createOrderAt(new Date(Date.UTC(2026, 8, 14, 15, 0, 0)), [
      { productId: productA1.id, quantity: 1, unitPrice: 100, unitCost: 60 },
    ]);

    const tokenA = await storeAdminToken('rep-owner-a@techstore.com');

    const weekTen = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ period: 'weekly', date: '2026-09-10' });
    expect(weekTen.body.totals).toMatchObject({ quantity: 2, profit: 80 });
    expect(weekTen.body.products[0].quantity).toBe(2);

    const weekFourteen = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ period: 'weekly', date: '2026-09-14' });
    expect(weekFourteen.body.totals).toMatchObject({ quantity: 1, profit: 40 });
  });

  test('informe mensual: el mes que contiene la fecha', async () => {
    await createOrderAt(new Date(Date.UTC(2026, 7, 20, 15, 0, 0)), [
      { productId: productA1.id, quantity: 1, unitPrice: 100, unitCost: 60 },
    ]);
    await createOrderAt(new Date(Date.UTC(2026, 8, 22, 15, 0, 0)), [
      { productId: productA1.id, quantity: 2, unitPrice: 100, unitCost: 60 },
    ]);

    const tokenA = await storeAdminToken('rep-owner-a@techstore.com');

    const september = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ period: 'monthly', date: '2026-09-10' });
    expect(september.body.totals).toMatchObject({ orders: 1, quantity: 2, profit: 80 });

    const august = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ period: 'monthly', date: '2026-08-05' });
    expect(august.body.totals).toMatchObject({ orders: 1, quantity: 1, profit: 40 });
    expect(august.body.products[0].name).toBe('Prod A1');
  });

  test('timeseries agrega la cantidad vendida por día y completa con ceros', async () => {
    await createOrderAt(new Date(Date.UTC(2026, 8, 10, 15, 0, 0)), [
      { productId: productA1.id, quantity: 2, unitPrice: 100, unitCost: 60 },
    ]);
    await createOrderAt(new Date(Date.UTC(2026, 8, 10, 20, 0, 0)), [
      { productId: productA2.id, quantity: 1, unitPrice: 50, unitCost: 30 },
    ]);
    await createOrderAt(new Date(Date.UTC(2026, 8, 12, 15, 0, 0)), [
      { productId: productA1.id, quantity: 1, unitPrice: 100, unitCost: 60 },
    ]);

    const res = await request(app)
      .get('/api/store-admin/reports/timeseries')
      .set('Authorization', `Bearer ${await storeAdminToken('rep-owner-a@techstore.com')}`)
      .query({ from: '2026-09-10', to: '2026-09-12' });

    expect(res.status).toBe(200);
    expect(res.body.points).toEqual([
      { date: '2026-09-10', quantity: 3 },
      { date: '2026-09-11', quantity: 0 },
      { date: '2026-09-12', quantity: 1 },
    ]);
  });

  test('timeseries: from posterior a to devuelve 400', async () => {
    const res = await request(app)
      .get('/api/store-admin/reports/timeseries')
      .set('Authorization', `Bearer ${await storeAdminToken('rep-owner-a@techstore.com')}`)
      .query({ from: '2026-09-12', to: '2026-09-10' });

    expect(res.status).toBe(400);
  });

  test('top-products: ranking por promedio mensual de mayor a menor (default 6 meses)', async () => {
    const { from } = getTopProductsWindow(6);
    const anchor = new Date(from.getTime() + 3 * 24 * 60 * 60 * 1000);
    await createOrderAt(anchor, [{ productId: productA1.id, quantity: 12, unitPrice: 100, unitCost: 60 }]);
    await createOrderAt(new Date(anchor.getTime() + 24 * 60 * 60 * 1000), [
      { productId: productA2.id, quantity: 3, unitPrice: 50, unitCost: 30 },
    ]);

    const res = await request(app)
      .get('/api/store-admin/reports/top-products')
      .set('Authorization', `Bearer ${await storeAdminToken('rep-owner-a@techstore.com')}`);

    expect(res.status).toBe(200);
    expect(res.body.months).toBe(6);
    expect(res.body.products).toHaveLength(2);
    expect(res.body.products[0].productId).toBe(productA1.id);
    expect(res.body.products[0].averageMonthlyQuantity).toBe(2);
    expect(res.body.products[0].totalQuantity).toBe(12);
    expect(res.body.products[1].productId).toBe(productA2.id);
    expect(res.body.products[1].averageMonthlyQuantity).toBe(0.5);
    const averages = res.body.products.map((p) => p.averageMonthlyQuantity);
    expect(averages).toEqual([...averages].sort((a, b) => b - a));
  });

  test('top-products: por defecto excluye ventas de la otra tienda y valida months', async () => {
    const { from } = getTopProductsWindow(12);
    const anchor = new Date(from.getTime() + 5 * 24 * 60 * 60 * 1000);
    await createOrderAt(anchor, [{ productId: productA1.id, quantity: 6, unitPrice: 100, unitCost: 60 }]);
    await createOrderAt(anchor, [{ productId: productB1.id, quantity: 600, unitPrice: 200, unitCost: 150 }]);

    const tokenA = await storeAdminToken('rep-owner-a@techstore.com');

    const res = await request(app)
      .get('/api/store-admin/reports/top-products?months=12')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.products.map((p) => p.productId)).toEqual([productA1.id]);
    expect(res.body.products[0].totalQuantity).toBe(6);

    const bad = await request(app)
      .get('/api/store-admin/reports/top-products?months=99')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(bad.status).toBe(400);
  });

  test('zona horaria Bogotá (UTC-5): una venta a las 04:30 UTC cae en el día bogotano anterior', async () => {
    const midnightOrder = await createOrderAt(new Date('2026-09-11T04:30:00.000Z'), [
      { productId: productA1.id, quantity: 1, unitPrice: 100, unitCost: 60 },
    ]);
    const morningOrder = await createOrderAt(new Date('2026-09-11T05:30:00.000Z'), [
      { productId: productA1.id, quantity: 1, unitPrice: 100, unitCost: 60 },
    ]);

    const tokenA = await storeAdminToken('rep-owner-a@techstore.com');

    const inTenth = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ period: 'daily', date: '2026-09-10' });
    expect(inTenth.body.totals).toMatchObject({ orders: 1, quantity: 1 });

    const inEleventh = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ period: 'daily', date: '2026-09-11' });
    expect(inEleventh.body.totals).toMatchObject({ orders: 1, quantity: 1 });

    const ts = await request(app)
      .get('/api/store-admin/reports/timeseries')
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ from: '2026-09-10', to: '2026-09-11' });
    expect(ts.body.points).toEqual([
      { date: '2026-09-10', quantity: 1 },
      { date: '2026-09-11', quantity: 1 },
    ]);

    expect(midnightOrder.createdAt.toISOString()).toBe('2026-09-11T04:30:00.000Z');
    expect(morningOrder.createdAt.toISOString()).toBe('2026-09-11T05:30:00.000Z');
  });

  test('pedidos pending y cancelled no cuentan en informe, timeseries ni top-products', async () => {
    const tokenA = await storeAdminToken('rep-owner-a@techstore.com');

    const confirmed = await createOrderAt(new Date(Date.UTC(2026, 8, 10, 15, 0, 0)), [
      { productId: productA1.id, quantity: 1, unitPrice: 100, unitCost: 60 },
    ]);
    const pending = await createOrderAt(new Date(Date.UTC(2026, 8, 10, 16, 0, 0)), [
      { productId: productA1.id, quantity: 5, unitPrice: 100, unitCost: 60 },
    ]);
    const cancelled = await createOrderAt(new Date(Date.UTC(2026, 8, 10, 17, 0, 0)), [
      { productId: productA1.id, quantity: 7, unitPrice: 100, unitCost: 60 },
    ]);
    await db.Order.update({ status: 'pending' }, { where: { id: pending.id } });
    await db.Order.update({ status: 'cancelled' }, { where: { id: cancelled.id } });

    const daily = await request(app)
      .get('/api/store-admin/reports')
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ period: 'daily', date: '2026-09-10' });
    expect(daily.body.totals).toMatchObject({ orders: 1, quantity: 1, revenue: 100, cost: 60, profit: 40 });

    const ts = await request(app)
      .get('/api/store-admin/reports/timeseries')
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ from: '2026-09-10', to: '2026-09-10' });
    expect(ts.body.points).toEqual([{ date: '2026-09-10', quantity: 1 }]);

    const { from } = getTopProductsWindow(12);
    const anchor = new Date(from.getTime() + 5 * 24 * 60 * 60 * 1000);
    await createOrderAt(anchor, [
      { productId: productA1.id, quantity: 2, unitPrice: 100, unitCost: 60 },
    ]);
    const cancelledRecent = await createOrderAt(anchor, [
      { productId: productA2.id, quantity: 9, unitPrice: 50, unitCost: 30 },
    ]);
    await db.Order.update({ status: 'cancelled' }, { where: { id: cancelledRecent.id } });

    const top = await request(app)
      .get('/api/store-admin/reports/top-products?months=12')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(top.body.products.map((p) => p.productId)).toEqual([productA1.id]);
    expect(top.body.products[0].totalQuantity).toBe(3);

    expect(confirmed.status).toBe('confirmed');
  });
});