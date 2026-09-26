import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';

let productA;
let productB;

async function seedCatalog() {
  const storeAdmin = await db.User.create({
    name: 'Store Owner',
    email: 'favs-store@techstore.com',
    passwordHash: await bcrypt.hash('secret123', 10),
    role: 'store_admin',
  });
  const store = await db.Store.create({
    name: 'Tienda Favoritos',
    slug: 'tienda-favoritos',
    whatsappNumber: '+541111111111',
    ownerUserId: storeAdmin.id,
    status: 'approved',
  });

  const categories = await db.Category.bulkCreate(
    [
      { name: 'Celulares', slug: 'celulares' },
      { name: 'Audio', slug: 'audio' },
    ],
    { returning: true },
  );
  const [celulares, audio] = categories;

  [productA, productB] = await db.Product.bulkCreate(
    [
      {
        name: 'Combo Favorito A',
        slug: 'combo-fav-a',
        price: 100,
        stock: 5,
        categoryId: celulares.id,
        storeId: store.id,
      },
      {
        name: 'Combo Favorito B',
        slug: 'combo-fav-b',
        price: 200,
        originalPrice: 250,
        stock: 3,
        categoryId: audio.id,
        storeId: store.id,
      },
    ],
    { returning: true },
  );
}

async function tokenFor(email) {
  await request(app).post('/api/auth/register').send({
    name: 'Customer User',
    email,
    password: 'secret123',
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return login.body.token;
}

describe('Favoritos API', () => {
  beforeEach(async () => {
    await db.sequelize.query('TRUNCATE TABLE categories, stores, users CASCADE;');
    await seedCatalog();
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('listar favoritos sin token devuelve 401', async () => {
    const res = await request(app).get('/api/favorites');

    expect(res.status).toBe(401);
  });

  test('agregar/quitar favoritos sin token devuelve 401', async () => {
    const add = await request(app).post(`/api/favorites/${productA.id}`);
    expect(add.status).toBe(401);

    const del = await request(app).delete(`/api/favorites/${productA.id}`);
    expect(del.status).toBe(401);
  });

  test('agregar favorito devuelve 201 (y 200 si ya estaba), y listar lo muestra', async () => {
    const token = await tokenFor('ana@example.com');

    const add = await request(app)
      .post(`/api/favorites/${productA.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(add.status).toBe(201);
    expect(add.body.favorite.productId).toBe(productA.id);
    expect(add.body.favorite.favoritedAt).toBeTruthy();

    const again = await request(app)
      .post(`/api/favorites/${productA.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(again.status).toBe(200);

    const list = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(list.body.favorites).toHaveLength(1);
    expect(list.body.favorites[0].product.slug).toBe('combo-fav-a');
    expect(list.body.favorites[0].product.price).toBe(100);
    expect(list.body.favorites[0].product.store.slug).toBe('tienda-favoritos');
    expect(list.body.favorites[0].product.category.slug).toBe('celulares');
  });

  test('listar devuelve el detalle enriquecido del producto favorito', async () => {
    const token = await tokenFor('beto@example.com');

    await request(app)
      .post(`/api/favorites/${productB.id}`)
      .set('Authorization', `Bearer ${token}`);

    const list = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token}`);

    expect(list.body.favorites[0].product.isNew).toBe(true);
    expect(list.body.favorites[0].product.discountPercent).toBe(20);
  });

  test('quitar favorito devuelve 204 y desaparece del listado', async () => {
    const token = await tokenFor('caro@example.com');

    await request(app)
      .post(`/api/favorites/${productA.id}`)
      .set('Authorization', `Bearer ${token}`);

    const del = await request(app)
      .delete(`/api/favorites/${productA.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(204);

    const list = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token}`);

    expect(list.body.favorites).toHaveLength(0);
  });

  test('un usuario no ve ni puede borrar favoritos de otro', async () => {
    const tokenA = await tokenFor('dani@example.com');
    const tokenB = await tokenFor('eve@example.com');

    await request(app)
      .post(`/api/favorites/${productA.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    const listB = await request(app).get('/api/favorites').set('Authorization', `Bearer ${tokenB}`);

    expect(listB.status).toBe(200);
    expect(listB.body.favorites).toHaveLength(0);

    const delB = await request(app)
      .delete(`/api/favorites/${productA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(delB.status).toBe(404);
  });

  test('agregar/quitar un producto inexistente devuelve 404', async () => {
    const token = await tokenFor('fede@example.com');

    const add = await request(app)
      .post('/api/favorites/99999')
      .set('Authorization', `Bearer ${token}`);

    expect(add.status).toBe(404);

    const del = await request(app)
      .delete('/api/favorites/99999')
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(404);
  });

  test('quitar un favorito que no existe devuelve 404', async () => {
    const token = await tokenFor('gaby@example.com');

    const del = await request(app)
      .delete(`/api/favorites/${productA.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(404);
  });
});
