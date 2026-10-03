import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';
import { __setTransporterFactoryForTests } from '../services/mailer.js';

const sentMails = [];

function installMockTransporter() {
  sentMails.length = 0;
  __setTransporterFactoryForTests(() => ({
    sendMail: async (mail) => {
      sentMails.push(mail);
      return { messageId: '<mock@localhost>' };
    },
  }));
}

async function tokenFor(email, role) {
  const passwordHash = await bcrypt.hash('secret123', 10);
  await db.User.create({ name: 'Admin', email, passwordHash, role });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return login.body.token;
}

function applyPayload(overrides = {}) {
  return {
    name: 'Tienda Nueva',
    slug: 'tienda-nueva',
    whatsapp_number: '+5491100000000',
    description: 'Vendo accesorios.',
    owner: { name: 'Prospecto', email: 'prospecto@techstore.com', password: 'clave1234' },
    ...overrides,
  };
}

async function createExistingStore(email, slug) {
  const passwordHash = await bcrypt.hash('secret123', 10);
  const user = await db.User.create({
    name: 'Dueño',
    email,
    passwordHash,
    role: 'store_admin',
  });
  return db.Store.create({
    name: 'Tienda Existente',
    slug,
    whatsappNumber: '+5491100000000',
    ownerUserId: user.id,
    status: 'approved',
  });
}

describe('Store applications (aplicar → aprobar/rechazar)', () => {
  beforeEach(async () => {
    await db.sequelize.query(
      'TRUNCATE TABLE store_applications, categories, stores, users CASCADE;',
    );
    installMockTransporter();
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('solicitud exitosa NO crea usuario ni tienda, solo la fila pending', async () => {
    const res = await request(app).post('/api/stores/apply').send(applyPayload());

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('pendiente');
    expect(res.body.application.status).toBe('pending');
    expect(res.body.application.slug).toBe('tienda-nueva');
    expect(res.body.application.storeName).toBe('Tienda Nueva');
    expect(res.body).not.toHaveProperty('store');
    expect(res.body).not.toHaveProperty('owner');
    expect(res.body).not.toHaveProperty('token');

    expect(await db.User.count()).toBe(0);
    expect(await db.Store.count()).toBe(0);

    const row = await db.StoreApplication.findOne({ where: { slug: 'tienda-nueva' } });
    expect(row).not.toBeNull();
    expect(row.applicantEmail).toBe('prospecto@techstore.com');
    expect(row.applicantPasswordHash).not.toBe('clave1234');
    expect(row.status).toBe('pending');
    expect(row.resultingStoreId).toBeNull();
  });

  test('falta de campos obligatorios devuelve 400 indicando cuáles', async () => {
    const sinSlug = await request(app)
      .post('/api/stores/apply')
      .send({
        name: 'Sin Slug',
        whatsapp_number: '+5491122',
        owner: { name: 'A', email: 'a@techstore.com', password: 'clave1234' },
      });
    expect(sinSlug.status).toBe(400);
    expect(sinSlug.body.error).toContain('slug');

    const sinPropietario = await request(app)
      .post('/api/stores/apply')
      .send({ name: 'Sin Dueño', slug: 'sin-dueno', whatsapp_number: '+5491122' });
    expect(sinPropietario.status).toBe(400);
    expect(sinPropietario.body.error).toContain('applicant_name');
    expect(sinPropietario.body.error).toContain('applicant_email');
    expect(sinPropietario.body.error).toContain('applicant_password');
  });

  test('apply con email de un usuario existente devuelve 409', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Cliente Existente',
      email: 'prospecto@techstore.com',
      password: 'secret123',
    });

    const res = await request(app).post('/api/stores/apply').send(applyPayload());

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Ya existe un usuario con ese email.');
  });

  test('slug duplicado contra una tienda existente devuelve 409', async () => {
    await createExistingStore('existente@techstore.com', 'tienda-nueva');

    const res = await request(app).post('/api/stores/apply').send(applyPayload());

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('slug "tienda-nueva" ya está en uso');
    expect(await db.StoreApplication.count()).toBe(0);
  });

  test('slug duplicado contra otra solicitud pending devuelve 409', async () => {
    await request(app).post('/api/stores/apply').send(applyPayload());

    const res = await request(app)
      .post('/api/stores/apply')
      .send(
        applyPayload({
          owner: { name: 'Otro', email: 'otro@techstore.com', password: 'clave1234' },
        }),
      );

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('solicitud pendiente con el slug');
    expect(await db.StoreApplication.count()).toBe(1);
  });

  test('aprobación crea usuario y tienda, y el dueño puede loguearse', async () => {
    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    const applyRes = await request(app).post('/api/stores/apply').send(applyPayload());
    const applicationId = applyRes.body.application.id;
    sentMails.length = 0;

    const res = await request(app)
      .put(`/api/admin/store-applications/${applicationId}/approve`)
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('approved');
    expect(res.body.application.reviewedAt).not.toBeNull();
    expect(res.body.application.rejectedReason).toBeNull();
    expect(res.body.user.role).toBe('store_admin');
    expect(res.body.store.status).toBe('approved');
    expect(res.body.store.slug).toBe('tienda-nueva');

    const user = await db.User.findOne({ where: { email: 'prospecto@techstore.com' } });
    expect(user).not.toBeNull();
    expect(user.role).toBe('store_admin');

    const store = await db.Store.findOne({ where: { slug: 'tienda-nueva' } });
    expect(store).not.toBeNull();
    expect(store.status).toBe('approved');
    expect(store.ownerUserId).toBe(user.id);
    expect(store.whatsappNumber).toBe('+5491100000000');
    expect(store.description).toBe('Vendo accesorios.');

    const row = await db.StoreApplication.findByPk(applicationId);
    expect(row.status).toBe('approved');
    expect(row.reviewedAt).not.toBeNull();
    expect(row.reviewedByUserId).not.toBeNull();
    expect(row.resultingStoreId).toBe(store.id);

    const login = await request(app).post('/api/auth/login').send({
      email: 'prospecto@techstore.com',
      password: 'clave1234',
    });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('store_admin');
    expect(login.body.user.storeStatus).toBe('approved');

    expect(sentMails).toHaveLength(1);
    expect(sentMails[0].to).toBe('prospecto@techstore.com');
    expect(sentMails[0].subject).toBe('Tu tienda "Tienda Nueva" fue aprobada');
  });

  test('rechazo NO crea usuario ni tienda y libera email+slug para una solicitud nueva', async () => {
    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    const applyRes = await request(app).post('/api/stores/apply').send(applyPayload());
    const applicationId = applyRes.body.application.id;
    sentMails.length = 0;

    const res = await request(app)
      .put(`/api/admin/store-applications/${applicationId}/reject`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ rejected_reason: 'Falta documentación' });

    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('rejected');
    expect(res.body.application.rejectedReason).toBe('Falta documentación');
    expect(res.body.application.reviewedAt).not.toBeNull();

    expect(await db.User.findOne({ where: { email: 'prospecto@techstore.com' } })).toBeNull();
    expect(await db.Store.count()).toBe(0);

    expect(sentMails).toHaveLength(1);
    expect(sentMails[0].to).toBe('prospecto@techstore.com');
    expect(sentMails[0].subject).toBe('Tu solicitud de tienda "Tienda Nueva" fue rechazada');
    expect(sentMails[0].text).toContain('Falta documentación');

    const reintento = await request(app).post('/api/stores/apply').send(applyPayload());
    expect(reintento.status).toBe(201);
  });

  test('rechazo exige rejected_reason', async () => {
    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    const applyRes = await request(app).post('/api/stores/apply').send(applyPayload());

    const res = await request(app)
      .put(`/api/admin/store-applications/${applyRes.body.application.id}/reject`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('rejected_reason');
  });

  test('aprobar o rechazar una solicitud ya procesada devuelve 409', async () => {
    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    const applyRes = await request(app).post('/api/stores/apply').send(applyPayload());
    const url = `/api/admin/store-applications/${applyRes.body.application.id}`;

    const approve = await request(app)
      .put(`${url}/approve`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(approve.status).toBe(200);

    const approveAgain = await request(app)
      .put(`${url}/approve`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(approveAgain.status).toBe(409);
    expect(approveAgain.body.error).toBe('Esta solicitud ya fue procesada.');

    const rejectAfterApprove = await request(app)
      .put(`${url}/reject`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ rejected_reason: 'Nope' });
    expect(rejectAfterApprove.status).toBe(409);

    const segundo = await request(app)
      .post('/api/stores/apply')
      .send(
        applyPayload({
          slug: 'segunda-tienda',
          owner: { name: 'Dos', email: 'dos@techstore.com', password: 'clave1234' },
        }),
      );
    const reject = await request(app)
      .put(`/api/admin/store-applications/${segundo.body.application.id}/reject`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ rejected_reason: 'Adiós' });
    expect(reject.status).toBe(200);

    const rejectAgain = await request(app)
      .put(`/api/admin/store-applications/${segundo.body.application.id}/reject`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ rejected_reason: 'Adiós de nuevo' });
    expect(rejectAgain.status).toBe(409);
  });

  test('admin y super_admin listan solicitudes con filtro; roles no admin dan 403', async () => {
    await request(app).post('/api/stores/apply').send(applyPayload());
    await request(app)
      .post('/api/stores/apply')
      .send(
        applyPayload({
          slug: 'tienda-dos',
          owner: { name: 'Dos', email: 'dos@techstore.com', password: 'clave1234' },
        }),
      );

    const customerToken = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Cliente', email: 'cliente@techstore.com', password: 'secret123' })
      .then((r) => r.body.token);
    const asCustomer = await request(app)
      .get('/api/admin/store-applications')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(asCustomer.status).toBe(403);

    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    const bySuper = await request(app)
      .get('/api/admin/store-applications')
      .set('Authorization', `Bearer ${superToken}`);
    expect(bySuper.status).toBe(200);
    expect(bySuper.body.applications).toHaveLength(2);
    expect(bySuper.body.applications.every((a) => a.applicantEmail)).toBe(true);

    const pending = await request(app)
      .get('/api/admin/store-applications')
      .query({ status: 'pending' })
      .set('Authorization', `Bearer ${superToken}`);
    expect(pending.body.applications).toHaveLength(2);

    const adminToken = await tokenFor('admin@techstore.com', 'admin');
    await request(app)
      .put(`/api/admin/store-applications/${bySuper.body.applications[0].id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const approved = await request(app)
      .get('/api/admin/store-applications')
      .query({ status: 'approved' })
      .set('Authorization', `Bearer ${superToken}`);
    expect(approved.body.applications).toHaveLength(1);

    const invalid = await request(app)
      .get('/api/admin/store-applications')
      .query({ status: 'shipped' })
      .set('Authorization', `Bearer ${superToken}`);
    expect(invalid.status).toBe(400);
  });
});
