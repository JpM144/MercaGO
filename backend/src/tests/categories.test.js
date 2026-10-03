import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';

let storeA;
let storeB;
let adminTokenA;
let adminTokenB;

async function seed() {
  const [userA, userB] = await db.User.bulkCreate(
    [
      {
        name: 'Dueño A',
        email: 'dueno-a@techstore.com',
        passwordHash: await bcrypt.hash('secret123', 10),
        role: 'store_admin',
      },
      {
        name: 'Dueño B',
        email: 'dueno-b@techstore.com',
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

  const catA = await db.Category.create({ name: 'Celulares', slug: 'celulares', storeId: storeA.id });
  await db.Product.create({
    name: 'Producto A',
    slug: 'prod-a',
    price: 100,
    stock: 10,
    categoryId: catA.id,
    storeId: storeA.id,
  });
  const catB = await db.Category.create({ name: 'Audio', slug: 'audio', storeId: storeB.id });

  async function login(email) {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
    return res.body.token;
  }
  adminTokenA = await login('dueno-a@techstore.com');
  adminTokenB = await login('dueno-b@techstore.com');

  return { catA, catB };
}

let catA;
let catB;

beforeAll(async () => {
  await db.sequelize.query('TRUNCATE TABLE products, categories, stores, users CASCADE;');
  ({ catA, catB } = await seed());
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('categorías privadas por tienda', () => {
  test('GET /api/store-admin/categories devuelve sólo las categorías propias', async () => {
    const a = await request(app)
      .get('/api/store-admin/categories')
      .set('Authorization', `Bearer ${adminTokenA}`);
    const b = await request(app)
      .get('/api/store-admin/categories')
      .set('Authorization', `Bearer ${adminTokenB}`);

    expect(a.status).toBe(200);
    expect(a.body.categories.map((c) => c.name)).toEqual(['Celulares']);
    expect(b.status).toBe(200);
    expect(b.body.categories.map((c) => c.name)).toEqual(['Audio']);
  });

  test('GET /api/store-admin/categories exige token y tienda aprobada', async () => {
    const anon = await request(app).get('/api/store-admin/categories');
    expect(anon.status).toBe(401);

    await storeB.update({ status: 'pending' });
    const blocked = await request(app)
      .get('/api/store-admin/categories')
      .set('Authorization', `Bearer ${adminTokenB}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toContain('aprobada');
    await storeB.update({ status: 'approved' });
  });

  test('POST crea la categoría en la tienda del store_admin y devuelve 201', async () => {
    const res = await request(app)
      .post('/api/store-admin/categories')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'Fundas y protectores' });

    expect(res.status).toBe(201);
    expect(res.body.category.name).toBe('Fundas y protectores');
    expect(res.body.category.slug).toBe('fundas-y-protectores');
    expect(res.body.category.storeId).toBe(storeA.id);

    const persisted = await db.Category.findByPk(res.body.category.id);
    expect(persisted.storeId).toBe(storeA.id);
  });

  test('POST rechaza name ausente o vacío con 400', async () => {
    for (const body of [{}, { name: '' }, { name: '   ' }, { name: 42 }]) {
      const res = await request(app)
        .post('/api/store-admin/categories')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('name');
    }
  });

  test('POST no acepta storeId en el body: la tienda es siempre la del token', async () => {
    const res = await request(app)
      .post('/api/store-admin/categories')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'Infiltrada', storeId: storeB.id });

    expect(res.status).toBe(201);
    expect(res.body.category.storeId).toBe(storeA.id);
  });

  test('el slug es único dentro de la tienda pero se repite entre tiendas', async () => {
    const a = await request(app)
      .post('/api/store-admin/categories')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'Accesorios' });
    const aDup = await request(app)
      .post('/api/store-admin/categories')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'Accesorios' });
    const b = await request(app)
      .post('/api/store-admin/categories')
      .set('Authorization', `Bearer ${adminTokenB}`)
      .send({ name: 'Accesorios' });

    expect(a.status).toBe(201);
    expect(a.body.category.slug).toBe('accesorios');
    expect(aDup.status).toBe(201);
    expect(aDup.body.category.slug).toBe('accesorios-2');
    expect(b.status).toBe(201);
    expect(b.body.category.slug).toBe('accesorios');
    expect(b.body.category.storeId).toBe(storeB.id);
  });

  test('un store_admin no ve categorías de otra tienda en el listado', async () => {
    await db.Category.create({ name: 'Secreto B', slug: 'secreto-b', storeId: storeB.id });

    const a = await request(app)
      .get('/api/store-admin/categories')
      .set('Authorization', `Bearer ${adminTokenA}`);

    expect(a.body.categories.some((c) => c.name === 'Secreto B')).toBe(false);
  });

  test('PUT de una categoría ajena devuelve 404 y no la modifica', async () => {
    const before = await db.Category.findByPk(catB.id);

    const res = await request(app)
      .put(`/api/store-admin/categories/${catB.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'Secreto' });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('no encontrada');

    const after = await db.Category.findByPk(catB.id);
    expect(after.name).toBe(before.name);
    expect(after.storeId).toBe(storeB.id);
  });

  test('PUT renombra y regenera el slug de una categoría propia', async () => {
    const res = await request(app)
      .put(`/api/store-admin/categories/${catA.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'Smartphones' });

    expect(res.status).toBe(200);
    expect(res.body.category.name).toBe('Smartphones');
    expect(res.body.category.slug).toBe('smartphones');
    expect(res.body.category.storeId).toBe(storeA.id);
  });

  test('PUT con slug duplicado dentro de la misma tienda reasigna sin pisar a nadie', async () => {
    const own = await db.Category.create({
      name: 'Temporal',
      slug: 'temporal',
      storeId: storeA.id,
    });
    const other = await db.Category.create({
      name: 'Temporal 2',
      slug: 'temporal-2',
      storeId: storeA.id,
    });

    const res = await request(app)
      .put(`/api/store-admin/categories/${other.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'Temporal' });

    expect(res.status).toBe(200);
    // "temporal" está ocupado, así que cae en el siguiente libre.
    expect(res.body.category.slug).toBe('temporal-2');
    expect(res.body.category.id).toBe(other.id);
    expect(own.slug).toBe('temporal');
  });

  test('PUT rechaza name vacío con 400', async () => {
    const res = await request(app)
      .put(`/api/store-admin/categories/${catA.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: '  ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('name');
  });

  test('DELETE de una categoría ajena devuelve 404 y no la borra', async () => {
    const res = await request(app)
      .delete(`/api/store-admin/categories/${catB.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`);

    expect(res.status).toBe(404);
    expect(await db.Category.findByPk(catB.id)).not.toBeNull();
  });

  test('DELETE con productos asociados devuelve 409 con mensaje claro', async () => {
    const res = await request(app)
      .delete(`/api/store-admin/categories/${catA.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('No se puede eliminar la categoría');
    expect(res.body.error).toContain('producto');
  });

  test('DELETE de una categoría vacía devuelve 204', async () => {
    const vacia = await db.Category.create({
      name: 'Vacía',
      slug: 'vacia',
      storeId: storeA.id,
    });

    const res = await request(app)
      .delete(`/api/store-admin/categories/${vacia.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`);

    expect(res.status).toBe(204);
    expect(await db.Category.findByPk(vacia.id)).toBeNull();
  });

  test('crear un producto con una categoría ajena devuelve 400', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'Producto Truchado', price: 10, categoryId: catB.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('no pertenece a tu tienda');
    expect(await db.Product.findOne({ where: { slug: 'producto-truchado' } })).toBeNull();
  });

  test('editar un producto asignándole una categoría ajena devuelve 400', async () => {
    const own = await db.Product.create({
      name: 'Propio',
      slug: 'propio',
      price: 10,
      stock: 1,
      categoryId: catA.id,
      storeId: storeA.id,
    });

    const res = await request(app)
      .put(`/api/products/${own.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ categoryId: catB.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('no pertenece a tu tienda');
    await own.reload();
    expect(own.categoryId).toBe(catA.id);
  });

  test('el filtro global por nombre trae productos de todas las tiendas con ese nombre', async () => {
    const catSharedA = await db.Category.create({
      name: 'Celulares',
      slug: 'celulares',
      storeId: storeA.id,
    });
    await db.Product.create({
      name: 'Producto A Celular',
      slug: 'prod-a-celular',
      price: 300,
      stock: 2,
      categoryId: catSharedA.id,
      storeId: storeA.id,
    });

    const catSharedB = await db.Category.create({
      name: 'Celulares',
      slug: 'celulares',
      storeId: storeB.id,
    });
    await db.Product.create({
      name: 'Producto B Celular',
      slug: 'prod-b-celular',
      price: 500,
      stock: 3,
      categoryId: catSharedB.id,
      storeId: storeB.id,
    });

    const res = await request(app).get('/api/products').query({ category: 'celulares' });

    expect(res.status).toBe(200);
    const slugs = res.body.products.map((p) => p.slug);
    expect(slugs).toContain('prod-a-celular');
    expect(slugs).toContain('prod-b-celular');

    const caseInsensitive = await request(app).get('/api/products').query({ category: 'CELULARES' });
    expect(caseInsensitive.body.products.map((p) => p.slug).sort()).toEqual(slugs.sort());
  });

  test('el catálogo por tienda resuelve el slug sólo dentro de esa tienda', async () => {
    const res = await request(app)
      .get('/api/stores/tienda-b/products')
      .query({ category: 'celulares' });

    expect(res.status).toBe(200);
    expect(res.body.products.map((p) => p.slug)).toEqual(['prod-b-celular']);
  });

  test('GET /api/categories es público y devuelve nombres sin datos internos', async () => {
    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    const names = res.body.categories.map((c) => c.name);
    expect(names).toContain('Celulares');
    expect(names).toContain('Audio');
    // "Celulares" existe en A y en B, pero el listado público lo muestra una sola vez.
    expect(names.filter((n) => n === 'Celulares').length).toBe(1);
    expect(Object.keys(res.body.categories[0])).toEqual(['name']);
  });

  test('las escrituras sobre /api/categories ya no existen', async () => {
    const admin = await db.User.create({
      name: 'Admin',
      email: 'admin-cats@techstore.com',
      passwordHash: await bcrypt.hash('secret123', 10),
      role: 'admin',
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'secret123' });

    const post = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ name: 'Global' });
    const put = await request(app)
      .put(`/api/categories/${catA.id}`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ name: 'Global' });
    const del = await request(app)
      .delete(`/api/categories/${catA.id}`)
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(post.status).toBe(404);
    expect(put.status).toBe(404);
    expect(del.status).toBe(404);
    expect(await db.Category.findOne({ where: { name: 'Global' } })).toBeNull();
  });
});
