import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';

const BASE = Date.now();
let celularesId;

async function seedCatalog() {
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
      createdAt: new Date(BASE - 4000),
    },
    {
      name: 'Samsung Galaxy S24',
      slug: 'galaxy-s24',
      description: 'Flagship de Samsung con Galaxy AI',
      price: 1099.99,
      stock: 30,
      categoryId: celulares.id,
      createdAt: new Date(BASE - 3000),
    },
    {
      name: 'Xiaomi Redmi Note 13',
      slug: 'redmi-note-13',
      description: 'Buena relación precio calidad',
      price: 349.99,
      stock: 40,
      categoryId: celulares.id,
      createdAt: new Date(BASE - 2000),
    },
    {
      name: 'AirPods Pro 2',
      slug: 'airpods-pro-2',
      description: 'Auriculares con cancelación de ruido',
      price: 279.99,
      stock: 22,
      categoryId: audio.id,
      createdAt: new Date(BASE - 1000),
    },
    {
      name: 'Sony WH-1000XM5',
      slug: 'sony-wh-1000xm5',
      description: 'Cancelación de ruido líder de la industria',
      price: 399.99,
      stock: 15,
      categoryId: audio.id,
      createdAt: new Date(BASE),
    },
  ]);
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

describe('Catálogo API', () => {
  beforeEach(async () => {
    await db.sequelize.query('TRUNCATE TABLE categories, users CASCADE;');
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

  test('crear producto siendo admin devuelve 201 y genera el slug', async () => {
    const token = await tokenFor('admin@techstore.com', 'admin');

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cargador USB-C 20W', price: 24.99, stock: 50, categoryId: celularesId });

    expect(res.status).toBe(201);
    expect(res.body.product.slug).toBe('cargador-usb-c-20w');
    expect(res.body.product.price).toBe(24.99);
    expect(res.body.product.categoryId).toBe(celularesId);
  });

  test('actualizar producto siendo admin devuelve 200', async () => {
    const token = await tokenFor('admin@techstore.com', 'admin');
    const product = await db.Product.findOne({ where: { slug: 'iphone-15' } });

    const res = await request(app)
      .put(`/api/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 1199.99 });

    expect(res.status).toBe(200);
    expect(res.body.product.price).toBe(1199.99);
  });

  test('eliminar producto siendo admin devuelve 204', async () => {
    const token = await tokenFor('admin@techstore.com', 'admin');

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

  test('borrar categoría con productos asociados devuelve 409 con mensaje claro', async () => {
    const token = await tokenFor('admin@techstore.com', 'admin');

    const res = await request(app)
      .delete(`/api/categories/${celularesId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('No se puede eliminar la categoría');
    expect(res.body.error).toContain('producto');
  });

  test('borrar categoría sin productos devuelve 204', async () => {
    const token = await tokenFor('admin@techstore.com', 'admin');
    const category = await db.Category.create({ name: 'Vacía', slug: 'vacia' });

    const res = await request(app)
      .delete(`/api/categories/${category.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});
