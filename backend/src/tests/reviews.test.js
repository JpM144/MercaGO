import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';

const FIVE_MB = 5 * 1024 * 1024;

let productId;

function photoBuffer(mime) {
  const content = mime === 'image/webp' ? Buffer.from('RIFF-WEBP-FOTO') : Buffer.from('PNG-FOTO');
  return { buffer: content, filename: mime === 'image/webp' ? 'foto.webp' : 'foto.png', mime };
}

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

  const categories = await db.Category.bulkCreate(
    [{ name: 'Celulares', slug: 'celulares', storeId: store.id }],
    { returning: true },
  );
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

async function tokenFor(email) {
  await request(app).post('/api/auth/register').send({
    name: 'Customer User',
    email,
    password: 'secret123',
  });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return login.body.token;
}

function postReview(token, { rating = 5, comment, photo } = {}) {
  let req = request(app)
    .post(`/api/products/${productId}/reviews`)
    .set('Authorization', `Bearer ${token}`)
    .field('rating', String(rating));
  if (comment !== undefined) {
    req = req.field('comment', comment);
  }
  if (photo) {
    req = req.attach('photo', photo.buffer, { filename: photo.filename, contentType: photo.mime });
  }
  return req;
}

describe('Reviews API', () => {
  beforeEach(async () => {
    await db.sequelize.query('TRUNCATE TABLE categories, stores, users CASCADE;');
    await seedCatalog();
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('un cliente sin compra previa puede reseñar; la foto se guarda y se sirve', async () => {
    const token = await tokenFor('cliente@techstore.com');

    const res = await postReview(token, {
      rating: 5,
      comment: 'Excelente teléfono',
      photo: photoBuffer('image/png'),
    });

    expect(res.status).toBe(201);
    expect(res.body.review.rating).toBe(5);
    expect(res.body.review.comment).toBe('Excelente teléfono');
    expect(res.body.review.photoUrl).toMatch(/^\/uploads\/reviews\/.+\.png$/);
    expect(res.body.review.user.name).toBe('Customer User');
    expect(res.body.review.user).not.toHaveProperty('email');

    const served = await request(app).get(res.body.review.photoUrl);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toContain('image/png');
  });

  test('la foto es obligatoria: una reseña sin foto devuelve 400', async () => {
    const token = await tokenFor('cliente@techstore.com');

    const res = await postReview(token, { rating: 5, comment: 'Sin foto' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('foto');
  });

  test('un tipo de archivo no permitido devuelve 400', async () => {
    const token = await tokenFor('cliente@techstore.com');

    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .field('rating', '5')
      .attach('photo', Buffer.from('texto plano'), { filename: 'nota.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('JPG, PNG o WebP');
  });

  test('un archivo mayor a 5 MB devuelve 400', async () => {
    const token = await tokenFor('cliente@techstore.com');

    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .field('rating', '5')
      .attach('photo', Buffer.alloc(FIVE_MB + 1024), { filename: 'grande.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('5 MB');
  });

  test('el detalle del producto refleja promedio, conteo y foto en cada reseña', async () => {
    const token = await tokenFor('cliente@techstore.com');
    await postReview(token, { rating: 4, comment: 'Muy bueno', photo: photoBuffer('image/png') });

    const otroToken = await tokenFor('otro@techstore.com');
    await postReview(otroToken, { rating: 2, photo: photoBuffer('image/webp') });

    const detail = await request(app).get('/api/products/iphone-15');

    expect(detail.status).toBe(200);
    expect(detail.body.ratingCount).toBe(2);
    expect(detail.body.ratingAverage).toBe(3);
    expect(detail.body.reviews.length).toBe(2);
    expect(detail.body.reviews.every((r) => r.photoUrl && r.photoUrl.startsWith('/uploads/reviews/'))).toBe(true);

    const list = await request(app).get(`/api/products/${productId}/reviews`);
    expect(list.status).toBe(200);
    expect(list.body.ratingCount).toBe(2);
    expect(list.body.reviews.length).toBe(2);
    expect(list.body.reviews.every((r) => r.user && typeof r.user.name === 'string')).toBe(true);
    expect(list.body.reviews.every((r) => r.photoUrl.startsWith('/uploads/reviews/'))).toBe(true);
  });

  test('intento de reseña duplicada devuelve 409', async () => {
    const token = await tokenFor('cliente@techstore.com');

    const first = await postReview(token, {
      rating: 5,
      comment: 'Primera reseña',
      photo: photoBuffer('image/png'),
    });
    expect(first.status).toBe(201);

    const second = await postReview(token, { rating: 1, photo: photoBuffer('image/webp') });
    expect(second.status).toBe(409);
    expect(second.body.error).toContain('Ya reseñaste');
  });

  test('reseña de producto inexistente devuelve 404', async () => {
    const token = await tokenFor('cliente@techstore.com');

    const res = await request(app)
      .post('/api/products/999999/reviews')
      .set('Authorization', `Bearer ${token}`)
      .field('rating', '5')
      .attach('photo', photoBuffer('image/png').buffer, { filename: 'foto.png', contentType: 'image/png' });

    expect(res.status).toBe(404);
  });

  test('rating fuera de rango devuelve 400', async () => {
    const token = await tokenFor('cliente@techstore.com');

    const res = await postReview(token, { rating: 7, photo: photoBuffer('image/png') });

    expect(res.status).toBe(400);
  });

  test('listar reseñas de producto inexistente devuelve 404', async () => {
    const res = await request(app).get('/api/products/999999/reviews');
    expect(res.status).toBe(404);
  });
});