import { jest } from '@jest/globals';
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

function applyPayload(overrides = {}) {
  return {
    name: 'Mi Tienda',
    slug: 'mi-tienda',
    whatsapp_number: '+5491122334455',
    description: 'Vendo accesorios.',
    owner: { name: 'Nuevo Dueño', email: 'nuevo@techstore.com', password: 'clave1234' },
    ...overrides,
  };
}

describe('Notificaciones por correo (Gmail SMTP)', () => {
  beforeEach(async () => {
    await db.sequelize.query(
      'TRUNCATE TABLE store_applications, categories, stores, users CASCADE;',
    );
    installMockTransporter();
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('solicitud nueva notifica a TODOS los super_admin con los datos de la tienda y del dueño', async () => {
    await tokenFor('super1@techstore.com', 'super_admin');
    await tokenFor('super2@techstore.com', 'super_admin');

    const res = await request(app).post('/api/stores/apply').send(applyPayload());

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
      .send(
        applyPayload({
          name: 'Tienda Feliz',
          slug: 'tienda-feliz',
          owner: { name: 'Dueña', email: 'duena@techstore.com', password: 'clave1234' },
        }),
      );
    expect(applyRes.status).toBe(201);

    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    sentMails.length = 0;

    const res = await request(app)
      .put(`/api/admin/store-applications/${applyRes.body.application.id}/approve`)
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('approved');
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
      .send(
        applyPayload({
          name: 'Tienda Triste',
          slug: 'tienda-triste',
          owner: { name: 'Dueño X', email: 'x@techstore.com', password: 'clave1234' },
        }),
      );
    expect(applyRes.status).toBe(201);

    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    sentMails.length = 0;

    const res = await request(app)
      .put(`/api/admin/store-applications/${applyRes.body.application.id}/reject`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ rejected_reason: 'Documentación incompleta' });

    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('rejected');
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
      .send(
        applyPayload({
          name: 'Tienda Sin Mail',
          slug: 'tienda-sin-mail',
          owner: { name: 'Dueño', email: 'sinmail@techstore.com', password: 'clave1234' },
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.application.status).toBe('pending');

    const application = await db.StoreApplication.findOne({
      where: { slug: 'tienda-sin-mail' },
    });
    expect(application).not.toBeNull();
    expect(application.status).toBe('pending');
    expect(await db.Store.count()).toBe(0);
  });

  test('un fallo del mailer no rompe la respuesta de PUT /api/admin/store-applications/:id/approve', async () => {
    const applyRes = await request(app)
      .post('/api/stores/apply')
      .send(
        applyPayload({
          name: 'Tienda Sin Mail 2',
          slug: 'tienda-sin-mail-2',
          owner: { name: 'Dueño', email: 'sinmail2@techstore.com', password: 'clave1234' },
        }),
      );
    expect(applyRes.status).toBe(201);

    const superToken = await tokenFor('super@techstore.com', 'super_admin');
    failMails = true;

    const res = await request(app)
      .put(`/api/admin/store-applications/${applyRes.body.application.id}/approve`)
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('approved');
  });

  test('sin super_admin cargado, la solicitud se crea igual sin error de mail', async () => {
    const res = await request(app)
      .post('/api/stores/apply')
      .send(
        applyPayload({
          name: 'Solo Dueño',
          slug: 'solo-dueno',
          whatsapp_number: '+5491100000004',
          owner: { name: 'Solo', email: 'solo@techstore.com', password: 'clave1234' },
        }),
      );

    expect(res.status).toBe(201);
    expect(sentMails).toHaveLength(0);
  });

  describe('cambio de plan', () => {
    let basico;
    let premium;

    beforeEach(async () => {
      await db.sequelize.query('TRUNCATE TABLE plan_tiers CASCADE;');
      [basico, premium] = await db.PlanTier.bulkCreate(
        [
          { name: 'Básico', price: 50000, productLimit: 20 },
          { name: 'Premium', price: 180000, productLimit: null },
        ],
        { returning: true },
      );
    });

    async function tiendaConSolicitud(email, slug) {
      const passwordHash = await bcrypt.hash('secret123', 10);
      const owner = await db.User.create({
        name: 'Dueña Tienda',
        email,
        passwordHash,
        role: 'store_admin',
      });
      await db.Store.create({
        name: 'Tienda Plan',
        slug,
        whatsappNumber: '+5491100000099',
        ownerUserId: owner.id,
        status: 'approved',
        planTierId: basico.id,
      });

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'secret123' });
      const created = await request(app)
        .post('/api/store-admin/plan-change-requests')
        .set('Authorization', `Bearer ${login.body.token}`)
        .field('requested_tier_id', String(premium.id))
        .attach('receipt', Buffer.from('%PDF-1.4 comprobante'), {
          filename: 'comprobante.pdf',
          contentType: 'application/pdf',
        });
      expect(created.status).toBe(201);

      return { requestId: created.body.request.id };
    }

    test('la aprobación notifica al store_admin con el nombre del nuevo plan', async () => {
      const { requestId } = await tiendaConSolicitud('planera@techstore.com', 'tienda-planera');
      const superToken = await tokenFor('super@techstore.com', 'super_admin');
      sentMails.length = 0;

      const res = await request(app)
        .put(`/api/super-admin/plan-change-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${superToken}`);

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('approved');
      expect(sentMails).toHaveLength(1);
      const mail = sentMails[0];
      expect(mail.to).toBe('planera@techstore.com');
      expect(mail.subject).toBe('Tu cambio de plan a "Premium" fue aprobado');
      expect(mail.text).toContain('¡Buenas noticias, Dueña Tienda!');
      expect(mail.text).toContain('Tienda Plan');
      expect(mail.text).toContain('Plan actual: Premium');
      expect(mail.text).toContain('/tienda/tienda-planera');
      expect(mail.text).toContain(
        'Ya registramos el comprobante de la transferencia que adjuntaste',
      );
      expect(mail.text).not.toContain('Motivo del rechazo');
    });

    test('el rechazo notifica al store_admin e incluye el motivo', async () => {
      const { requestId } = await tiendaConSolicitud('planera2@techstore.com', 'tienda-planera-2');
      const superToken = await tokenFor('super@techstore.com', 'super_admin');
      sentMails.length = 0;

      const res = await request(app)
        .put(`/api/super-admin/plan-change-requests/${requestId}/reject`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ rejected_reason: 'Coordinamos el pago por fuera del sistema.' });

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('rejected');
      expect(sentMails).toHaveLength(1);
      const mail = sentMails[0];
      expect(mail.to).toBe('planera2@techstore.com');
      expect(mail.subject).toBe('Tu solicitud de cambio de plan a "Premium" fue rechazada');
      expect(mail.text).toContain('Hola Dueña Tienda');
      expect(mail.text).toContain('Motivo del rechazo: Coordinamos el pago por fuera del sistema.');
      expect(mail.text).toContain('Tu tienda mantiene su plan actual.');

      // El rechazo no debe alterar el plan vigente de la tienda.
      const store = await db.Store.findOne({ where: { slug: 'tienda-planera-2' } });
      expect(store.planTierId).toBe(basico.id);
    });

    test('un fallo del mailer en el rechazo NO se silencia: registra el error con el nombre de la tienda', async () => {
      const { requestId } = await tiendaConSolicitud('planera5@techstore.com', 'tienda-planera-5');
      const superToken = await tokenFor('super@techstore.com', 'super_admin');
      failMails = true;
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(app)
        .put(`/api/super-admin/plan-change-requests/${requestId}/reject`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ rejected_reason: 'Sin coordinación de pago.' });

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('rejected');

      const logged = errorSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(logged).toContain('Tienda Plan');
      expect(logged).toContain('SMTP connection refused (mock)');
      errorSpy.mockRestore();
    });

    test('un fallo del mailer no rompe la respuesta de approve', async () => {
      const { requestId } = await tiendaConSolicitud('planera3@techstore.com', 'tienda-planera-3');
      const superToken = await tokenFor('super@techstore.com', 'super_admin');
      failMails = true;

      const res = await request(app)
        .put(`/api/super-admin/plan-change-requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${superToken}`);

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('approved');
      const store = await db.Store.findOne({ where: { slug: 'tienda-planera-3' } });
      expect(store.planTierId).toBe(premium.id);
    });

    test('un fallo del mailer no rompe la respuesta de reject', async () => {
      const { requestId } = await tiendaConSolicitud('planera4@techstore.com', 'tienda-planera-4');
      const superToken = await tokenFor('super@techstore.com', 'super_admin');
      failMails = true;

      const res = await request(app)
        .put(`/api/super-admin/plan-change-requests/${requestId}/reject`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ rejected_reason: 'Sin coordinación de pago.' });

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe('rejected');
      expect(res.body.request.rejectedReason).toBe('Sin coordinación de pago.');
    });
  });
});
