import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import db from '../models/index.js';
import { __setTransporterFactoryForTests } from '../services/mailer.js';

const sentMails = [];
let failMails = false;

function installMockTransporter() {
  sentMails.length = 0;
  failMails = false;
  __setTransporterFactoryForTests(() => ({
    sendMail: async (mail) => {
      if (failMails) {
        throw new Error('SMTP connection refused (mock)');
      }
      sentMails.push(mail);
      return { messageId: '<mock@localhost>' };
    },
  }));
}

async function tokenFor(email, role) {
  const passwordHash = await bcrypt.hash('secret123', 10);
  await db.User.create({ name: 'Role User', email, passwordHash, role });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return login.body.token;
}

describe('Notificaciones por correo (Gmail SMTP)', () => {
  beforeEach(async () => {
    await db.sequelize.query('TRUNCATE TABLE categories, stores, users CASCADE;');
    installMockTransporter();
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('solicitud nueva notifica a TODOS los super_admin con los datos de la tienda y del dueño', async () => {
    await tokenFor('super1@techstore.com', 'super_admin');
    await tokenFor('super2@techstore.com', 'super_admin');

    const res = await request(app)
      .post('/api/stores/apply')
      .send({
        name: 'Mi Tienda',
        whatsapp_number: '+5491122334455',
        description: 'Vendo accesorios.',
        owner: { name: 'Nuevo Dueño', email: 'nuevo@techstore.com', password: 'clave1234' },
      });

    expect(res.status).toBe(201);
    expect(sentMails).toHaveLength(1);
    const mail = sentMails[0];
    expect([...mail.to].sort()).toEqual(['super1@techstore.com', 'super2@techstore.com']);
    expect(mail.to).not.toContain('nuevo@techstore.com');
    expect(mail.subject).toBe('Nueva solicitud de tienda: Mi Tienda');
    expect(mail.text).toContain('Nuevo Dueño');
    expect(mail.text).toContain('nuevo@techstore.com');
    expect(mail.text).toContain('+5491122334455');
    expect(mail.text).toContain('/tienda/mi-tienda');
  });

  test('aprobación notifica al dueño con texto de bienvenida (sin motivo)', async () => {
    const applyRes = await request(app)
      .post('/api/stores/apply')
      .send({
        name: 'Tienda Feliz',
        whatsapp_number: '+5491100000000',
        owner: { name: 'Dueña', email: 'duena@techstore.com', password: 'clave1234' },
      });
    expect(applyRes.status).toBe(201);

    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    sentMails.length = 0;

    const res = await request(app)
      .put(`/api/admin/stores/${applyRes.body.store.id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(sentMails).toHaveLength(1);
    const mail = sentMails[0];
    expect(mail.to).toBe('duena@techstore.com');
    expect(mail.subject).toBe('Tu tienda "Tienda Feliz" fue aprobada');
    expect(mail.text).toContain('¡Buenas noticias');
    expect(mail.text).toContain('/tienda/tienda-feliz');
    expect(mail.text).not.toContain('rechazada');
    expect(mail.text).not.toContain('Motivo del rechazo');
  });

  test('rechazo notifica al dueño e incluye el motivo', async () => {
    const applyRes = await request(app)
      .post('/api/stores/apply')
      .send({
        name: 'Tienda Triste',
        whatsapp_number: '+5491100000001',
        owner: { name: 'Dueño X', email: 'x@techstore.com', password: 'clave1234' },
      });
    expect(applyRes.status).toBe(201);

    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    sentMails.length = 0;

    const res = await request(app)
      .put(`/api/admin/stores/${applyRes.body.store.id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'rejected', rejected_reason: 'Documentación incompleta' });

    expect(res.status).toBe(200);
    expect(sentMails).toHaveLength(1);
    const mail = sentMails[0];
    expect(mail.to).toBe('x@techstore.com');
    expect(mail.subject).toBe('Tu solicitud de tienda "Tienda Triste" fue rechazada');
    expect(mail.text).toContain('Documentación incompleta');
    expect(mail.text).toContain('rechazada');
  });

  test('un fallo del mailer no rompe la respuesta de POST /api/stores/apply', async () => {
    await tokenFor('super@techstore.com', 'super_admin');
    failMails = true;

    const res = await request(app)
      .post('/api/stores/apply')
      .send({
        name: 'Tienda Sin Mail',
        whatsapp_number: '+5491100000002',
        owner: { name: 'Dueño', email: 'sinmail@techstore.com', password: 'clave1234' },
      });

    expect(res.status).toBe(201);
    expect(res.body.store.status).toBe('pending');

    const store = await db.Store.findOne({ where: { slug: 'tienda-sin-mail' } });
    expect(store).not.toBeNull();
    expect(store.status).toBe('pending');
  });

  test('un fallo del mailer no rompe la respuesta de PUT /api/admin/stores/:id/status', async () => {
    const applyRes = await request(app)
      .post('/api/stores/apply')
      .send({
        name: 'Tienda Sin Mail 2',
        whatsapp_number: '+5491100000003',
        owner: { name: 'Dueño', email: 'sinmail2@techstore.com', password: 'clave1234' },
      });
    expect(applyRes.status).toBe(201);

    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    failMails = true;

    const res = await request(app)
      .put(`/api/admin/stores/${applyRes.body.store.id}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.store.status).toBe('approved');
  });

  test('sin super_admin cargado, la solicitud se crea igual sin error de mail', async () => {
    const res = await request(app)
      .post('/api/stores/apply')
      .send({
        name: 'Solo Dueño',
        whatsapp_number: '+5491100000004',
        owner: { name: 'Solo', email: 'solo@techstore.com', password: 'clave1234' },
      });

    expect(res.status).toBe(201);
    expect(sentMails).toHaveLength(0);
  });
});
