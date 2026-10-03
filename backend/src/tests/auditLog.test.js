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
  await db.User.create({ name: 'Auditor', email, passwordHash, role });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return login.body.token;
}

function applyPayload(overrides = {}) {
  return {
    name: 'Tienda Auditoría',
    slug: 'tienda-auditoria',
    whatsapp_number: '+5491100000000',
    description: 'Tienda para auditar.',
    owner: { name: 'Prospecto', email: 'aud-prospecto@techstore.com', password: 'clave1234' },
    ...overrides,
  };
}

async function applyGetId(payload) {
  const res = await request(app).post('/api/stores/apply').send(payload);
  expect(res.status).toBe(201);
  return res.body.application.id;
}

async function approve(superToken, applicationId) {
  const res = await request(app)
    .put(`/api/admin/store-applications/${applicationId}/approve`)
    .set('Authorization', `Bearer ${superToken}`);
  expect(res.status).toBe(200);
  return res.body;
}

describe('Auditoría de acciones admin/super_admin', () => {
  beforeEach(async () => {
    await db.sequelize.query(
      'TRUNCATE TABLE audit_logs, store_applications, categories, stores, users CASCADE;',
    );
    installMockTransporter();
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('aprobar solicitud escribe el log de auditoría con actor y detalles', async () => {
    const superToken = await tokenFor('aud-super@techstore.com', 'super_admin');
    const applicationId = await applyGetId(applyPayload());

    await approve(superToken, applicationId);

    const log = await db.AuditLog.findOne({ where: { targetId: applicationId } });
    expect(log).not.toBeNull();
    expect(log.action).toBe('approve_application');
    expect(log.targetType).toBe('store_application');
    expect(log.targetId).toBe(applicationId);
    expect(log.actorUserId).not.toBeNull();
    expect(log.details.targetName).toBe('Tienda Auditoría');
    expect(log.details.targetSlug).toBe('tienda-auditoria');
    expect(log.details.applicantEmail).toBe('aud-prospecto@techstore.com');
    expect(log.details.resultingStoreId).not.toBeNull();
    expect(log.details.actorEmail).toBe('aud-super@techstore.com');
    expect(log.createdAt).not.toBeNull();

    const listing = await request(app)
      .get('/api/super-admin/audit-log')
      .set('Authorization', `Bearer ${superToken}`);
    expect(listing.status).toBe(200);
    expect(listing.body.logs).toHaveLength(1);
    expect(listing.body.logs[0].action).toBe('approve_application');
    expect(listing.body.logs[0].actionLabel).toBe('Aprobó la solicitud');
    expect(listing.body.logs[0].summary).toBe('Aprobó la solicitud «Tienda Auditoría»');
    expect(listing.body.logs[0].targetType).toBe('store_application');
    expect(listing.body.logs[0].targetId).toBe(applicationId);
    expect(listing.body.logs[0].actor.email).toBe('aud-super@techstore.com');
    expect(listing.body.logs[0].actor.name).toBe('Auditor');
    expect(typeof listing.body.logs[0].createdAt).toBe('string');
  });

  test('rechazar solicitud escribe el log con el motivo en details', async () => {
    const superToken = await tokenFor('aud-super2@techstore.com', 'super_admin');
    const applicationId = await applyGetId(
      applyPayload({ slug: 'tienda-aud-rechazo', owner: { ...applyPayload().owner, email: 'aud-prospect2@techstore.com' } }),
    );

    const reject = await request(app)
      .put(`/api/admin/store-applications/${applicationId}/reject`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ rejected_reason: 'Documentación incompleta' });
    expect(reject.status).toBe(200);

    const log = await db.AuditLog.findOne({ where: { targetId: applicationId } });
    expect(log.action).toBe('reject_application');
    expect(log.targetType).toBe('store_application');
    expect(log.details.reason).toBe('Documentación incompleta');
    expect(log.actorUserId).not.toBeNull();

    const listing = await request(app)
      .get('/api/super-admin/audit-log')
      .set('Authorization', `Bearer ${superToken}`);
    expect(listing.body.logs[0].summary).toBe('Rechazó la solicitud «Tienda Auditoría»');
  });

  test('pausar, reactivar y cancelar tienda escriben sus logs con el actor correcto', async () => {
    const approverToken = await tokenFor('aud-aprov@techstore.com', 'super_admin');
    const applicationId = await applyGetId(
      applyPayload({ slug: 'tienda-aud-plan', owner: { ...applyPayload().owner, email: 'aud-prospect3@techstore.com' } }),
    );
    await approve(approverToken, applicationId);
    const store = await db.Store.findOne({ where: { slug: 'tienda-aud-plan' } });

    const opToken = await tokenFor('aud-ops@techstore.com', 'super_admin');

    const pauseRes = await request(app)
      .put(`/api/super-admin/stores/${store.id}/pause`)
      .set('Authorization', `Bearer ${opToken}`);
    expect(pauseRes.status).toBe(200);

    const reactRes = await request(app)
      .put(`/api/super-admin/stores/${store.id}/reactivate`)
      .set('Authorization', `Bearer ${opToken}`);
    expect(reactRes.status).toBe(200);

    const cancelRes = await request(app)
      .put(`/api/super-admin/stores/${store.id}/cancel`)
      .set('Authorization', `Bearer ${opToken}`);
    expect(cancelRes.status).toBe(200);

    const logs = await db.AuditLog.findAll({ where: { targetType: 'store', targetId: store.id } });
    const actions = logs.map((log) => log.action).sort();
    expect(actions).toEqual(['cancel_store', 'pause_store', 'reactivate_store']);

    for (const log of logs) {
      expect(log.actorUserId).not.toBeNull();
      expect(log.details.targetName).toBe('Tienda Auditoría');
      expect(log.details.targetSlug).toBe('tienda-aud-plan');
      expect(log.details.actorEmail).toBe('aud-ops@techstore.com');
    }

    const pauseLog = logs.find((log) => log.action === 'pause_store');
    expect(pauseLog.details.planStatus).toBe('paused');
    const cancelLog = logs.find((log) => log.action === 'cancel_store');
    expect(cancelLog.details.planStatus).toBe('cancelled');
    const reactLog = logs.find((log) => log.action === 'reactivate_store');
    expect(reactLog.details.planStatus).toBe('active');

    const listing = await request(app)
      .get('/api/super-admin/audit-log')
      .set('Authorization', `Bearer ${opToken}`);
    expect(listing.body.logs.filter((log) => log.targetType === 'store')).toHaveLength(3);
  });

  test('el listado ordena más reciente primero y filtra por action', async () => {
    const superToken = await tokenFor('aud-filtro@techstore.com', 'super_admin');

    const appPause = await applyGetId(
      applyPayload({ slug: 'aud-filtro-1', owner: { ...applyPayload().owner, email: 'aud-f1@techstore.com' } }),
    );
    await approve(superToken, appPause);
    const store1 = await db.Store.findOne({ where: { slug: 'aud-filtro-1' } });
    await request(app)
      .put(`/api/super-admin/stores/${store1.id}/pause`)
      .set('Authorization', `Bearer ${superToken}`);

    const appReject = await applyGetId(
      applyPayload({ slug: 'aud-filtro-2', owner: { ...applyPayload().owner, email: 'aud-f2@techstore.com' } }),
    );
    await request(app)
      .put(`/api/admin/store-applications/${appReject}/reject`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ rejected_reason: 'No cumple' });

    const all = await request(app)
      .get('/api/super-admin/audit-log')
      .set('Authorization', `Bearer ${superToken}`);
    expect(all.body.logs.map((log) => log.action)).toEqual([
      'reject_application',
      'pause_store',
      'approve_application',
    ]);

    const pausedOnly = await request(app)
      .get('/api/super-admin/audit-log?action=pause_store')
      .set('Authorization', `Bearer ${superToken}`);
    expect(pausedOnly.body.logs).toHaveLength(1);
    expect(pausedOnly.body.logs[0].targetId).toBe(store1.id);

    const approvedOnly = await request(app)
      .get('/api/super-admin/audit-log?action=approve_application')
      .set('Authorization', `Bearer ${superToken}`);
    expect(approvedOnly.body.logs).toHaveLength(1);
  });

  test('el listado filtra por rango de fechas (from/to)', async () => {
    const superToken = await tokenFor('aud-fechas@techstore.com', 'super_admin');

    const before = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const after = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const oldDay = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const appA = await applyGetId(
      applyPayload({ slug: 'aud-fecha-1', owner: { ...applyPayload().owner, email: 'aud-d1@techstore.com' } }),
    );
    await approve(superToken, appA);
    const storeA = await db.Store.findOne({ where: { slug: 'aud-fecha-1' } });
    await request(app)
      .put(`/api/super-admin/stores/${storeA.id}/pause`)
      .set('Authorization', `Bearer ${superToken}`);

    const appB = await applyGetId(
      applyPayload({ slug: 'aud-fecha-2', owner: { ...applyPayload().owner, email: 'aud-d2@techstore.com' } }),
    );
    await approve(superToken, appB);

    const rangeOk = await request(app)
      .get(`/api/super-admin/audit-log?from=${encodeURIComponent(before)}&to=${encodeURIComponent(after)}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(rangeOk.status).toBe(200);
    expect(rangeOk.body.logs).toHaveLength(3);

    const noMatch = await request(app)
      .get(`/api/super-admin/audit-log?from=${encodeURIComponent(future)}&to=${encodeURIComponent(future)}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(noMatch.body.logs).toHaveLength(0);

    const beforeAll = await request(app)
      .get(`/api/super-admin/audit-log?from=${encodeURIComponent(oldDay)}&to=${encodeURIComponent(oldDay)}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(beforeAll.body.logs).toHaveLength(0);
  });

  test('solo super_admin puede leer el audit-log; admin y customer reciben 403', async () => {
    const adminToken = await tokenFor('aud-admin@techstore.com', 'admin');
    const customer = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Cliente', email: 'aud-cliente@techstore.com', password: 'secret123' });
    const customerToken = customer.body.token;
    const superToken = await tokenFor('aud-super3@techstore.com', 'super_admin');

    for (const token of [adminToken, customerToken]) {
      const res = await request(app)
        .get('/api/super-admin/audit-log')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    }

    const ok = await request(app)
      .get('/api/super-admin/audit-log')
      .set('Authorization', `Bearer ${superToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.logs).toEqual([]);
  });

  test('parámetros inválidos en el listado devuelven 400', async () => {
    const superToken = await tokenFor('aud-inv@techstore.com', 'super_admin');

    const badAction = await request(app)
      .get('/api/super-admin/audit-log?action=borrar_todo')
      .set('Authorization', `Bearer ${superToken}`);
    expect(badAction.status).toBe(400);

    const badFrom = await request(app)
      .get('/api/super-admin/audit-log?from=no-es-fecha')
      .set('Authorization', `Bearer ${superToken}`);
    expect(badFrom.status).toBe(400);
  });
});