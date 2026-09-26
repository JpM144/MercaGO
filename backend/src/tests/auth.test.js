import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';

async function createUser(overrides = {}) {
  const passwordHash = await bcrypt.hash(overrides.password ?? 'secret123', 10);
  return db.User.create({
    name: overrides.name ?? 'Test User',
    email: overrides.email ?? 'test@techstore.com',
    passwordHash,
    role: overrides.role ?? 'customer',
  });
}

describe('Auth API', () => {
  beforeEach(async () => {
    await db.sequelize.query('TRUNCATE TABLE users CASCADE;');
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('registro exitoso crea un customer y devuelve un JWT', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Ana Pérez',
      email: 'ana@techstore.com',
      password: 'clave1234',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.split('.').length).toBe(3);
    expect(res.body.user).toMatchObject({
      name: 'Ana Pérez',
      email: 'ana@techstore.com',
      role: 'customer',
    });
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const stored = await db.User.findOne({ where: { email: 'ana@techstore.com' } });
    expect(stored.role).toBe('customer');
    expect(stored.passwordHash).not.toBe('clave1234');
  });

  test('registro con email duplicado devuelve 409', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Ana Pérez',
      email: 'dup@techstore.com',
      password: 'clave1234',
    });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Otra Persona',
      email: 'dup@techstore.com',
      password: 'otraclave',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBeTruthy();
  });

  test('login exitoso devuelve un JWT', async () => {
    await createUser({ email: 'login@techstore.com', password: 'clave1234' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'login@techstore.com',
      password: 'clave1234',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('login@techstore.com');
  });

  test('login con password incorrecto devuelve 401', async () => {
    await createUser({ email: 'login@techstore.com', password: 'clave1234' });

    const res = await request(app).post('/api/auth/login').send({
      email: 'login@techstore.com',
      password: 'incorrecta',
    });

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('token');
  });

  test('ruta protegida sin token devuelve 401', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
  });

  test('ruta protegida con token válido devuelve el usuario', async () => {
    await createUser({ email: 'me@techstore.com' });
    const login = await request(app).post('/api/auth/login').send({
      email: 'me@techstore.com',
      password: 'secret123',
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@techstore.com');
  });

  test('ruta de admin con token de customer devuelve 403', async () => {
    await createUser({ email: 'customer@techstore.com' });
    const login = await request(app).post('/api/auth/login').send({
      email: 'customer@techstore.com',
      password: 'secret123',
    });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(403);
  });

  test('ruta de admin con usuario admin devuelve 200', async () => {
    await createUser({ email: 'admin@techstore.com', role: 'admin' });
    const login = await request(app).post('/api/auth/login').send({
      email: 'admin@techstore.com',
      password: 'secret123',
    });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Acceso de administrador concedido.');
    expect(res.body.user.role).toBe('admin');
  });
});
