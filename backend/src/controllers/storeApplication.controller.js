import bcrypt from 'bcryptjs';
import db from '../models/index.js';
import { sendStoreApplicationNotice, sendStoreStatusNotice } from '../services/mailer.js';
import { addOneMonth } from '../utils/plan.util.js';
import { getDefaultPlanTier } from '../utils/planTier.util.js';

const SALT_ROUNDS = 10;
const PASSWORD_MIN = 6;
const STATUSES = ['pending', 'approved', 'rejected'];

const APPLICATION_INCLUDES = [
  {
    model: db.User,
    as: 'reviewedBy',
    attributes: ['id', 'name', 'email'],
    required: false,
  },
  {
    model: db.Store,
    as: 'resultingStore',
    attributes: ['id', 'name', 'slug', 'status'],
    required: false,
  },
];

function toApplicationJson(application) {
  const json = application.get({ plain: true });
  delete json.applicantPasswordHash;
  return json;
}

export async function applyForStore(req, res, next) {
  try {
    const payload = req.body ?? {};
    const storeName = payload.store_name ?? payload.name;
    const slug = typeof payload.slug === 'string' ? payload.slug.trim() : payload.slug;
    const whatsapp = payload.whatsapp_number ?? payload.whatsappNumber;
    const description = payload.description ?? null;
    const applicantName = payload.applicant_name ?? payload.owner?.name ?? payload.owner_name;
    const email = payload.applicant_email ?? payload.owner?.email ?? payload.owner_email;
    const password =
      payload.applicant_password ?? payload.owner?.password ?? payload.owner_password;

    const missing = [];
    if (!storeName || typeof storeName !== 'string' || !storeName.trim())
      missing.push('store_name');
    if (!slug || typeof slug !== 'string') missing.push('slug');
    if (!whatsapp || typeof whatsapp !== 'string') missing.push('whatsapp_number');
    if (!applicantName || typeof applicantName !== 'string') missing.push('applicant_name');
    if (!email || typeof email !== 'string') missing.push('applicant_email');
    if (!password || typeof password !== 'string') missing.push('applicant_password');

    if (missing.length > 0) {
      return res.status(400).json({ error: `Faltan campos obligatorios: ${missing.join(', ')}.` });
    }

    if (password.length < PASSWORD_MIN) {
      return res
        .status(400)
        .json({ error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.` });
    }

    const existingUser = await db.User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
    }

    const existingStore = await db.Store.findOne({ where: { slug } });
    if (existingStore) {
      return res.status(409).json({ error: `El slug "${slug}" ya está en uso por otra tienda.` });
    }

    const pendingApplication = await db.StoreApplication.findOne({
      where: { slug, status: 'pending' },
    });
    if (pendingApplication) {
      return res
        .status(409)
        .json({ error: `Ya existe una solicitud pendiente con el slug "${slug}".` });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const application = await db.StoreApplication.create({
      storeName: storeName.trim(),
      slug,
      whatsappNumber: whatsapp.trim(),
      description: description?.trim() ? description.trim() : null,
      applicantName: applicantName.trim(),
      applicantEmail: email.trim(),
      applicantPasswordHash: passwordHash,
      status: 'pending',
    });

    try {
      await sendStoreApplicationNotice({
        store: {
          name: application.storeName,
          slug: application.slug,
          description: application.description,
          whatsappNumber: application.whatsappNumber,
        },
        owner: {
          name: application.applicantName,
          email: application.applicantEmail,
        },
      });
    } catch (mailError) {
      console.error(
        '[mailer] No se pudo notificar la nueva solicitud de tienda:',
        mailError.message,
      );
    }

    return res.status(201).json({
      message:
        'Tu solicitud quedó pendiente de revisión. Te avisaremos por email cuando la aprobemos.',
      application: {
        id: application.id,
        storeName: application.storeName,
        slug: application.slug,
        status: application.status,
        createdAt: application.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function listStoreApplications(req, res, next) {
  try {
    const { status } = req.query ?? {};

    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status inválido. Valores permitidos: ${STATUSES.join(', ')}.`,
      });
    }

    const where = status ? { status } : {};
    const applications = await db.StoreApplication.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: APPLICATION_INCLUDES,
    });

    return res.json({ applications: applications.map(toApplicationJson) });
  } catch (error) {
    return next(error);
  }
}

async function findApplication(id) {
  return db.StoreApplication.findByPk(id, { include: APPLICATION_INCLUDES });
}

export async function approveApplication(req, res, next) {
  try {
    const application = await findApplication(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }
    if (application.status !== 'pending') {
      return res.status(409).json({ error: 'Esta solicitud ya fue procesada.' });
    }

    const { user, store } = await db.sequelize.transaction(async (t) => {
      const newUser = await db.User.create(
        {
          name: application.applicantName,
          email: application.applicantEmail,
          passwordHash: application.applicantPasswordHash,
          role: 'store_admin',
        },
        { transaction: t },
      );
      const now = new Date();
      const defaultTier = await getDefaultPlanTier();
      const newStore = await db.Store.create(
        {
          name: application.storeName,
          slug: application.slug,
          whatsappNumber: application.whatsappNumber,
          description: application.description,
          ownerUserId: newUser.id,
          status: 'approved',
          planTierId: defaultTier?.id ?? null,
          planStartedAt: now,
          planExpiresAt: addOneMonth(now),
        },
        { transaction: t },
      );

      await application.update(
        {
          status: 'approved',
          reviewedByUserId: req.user.id,
          reviewedAt: new Date(),
          resultingStoreId: newStore.id,
        },
        { transaction: t },
      );

      await db.AuditLog.create(
        {
          actorUserId: req.user.id,
          action: 'approve_application',
          targetType: 'store_application',
          targetId: application.id,
          details: {
            targetName: application.storeName,
            targetSlug: application.slug,
            applicantEmail: application.applicantEmail,
            resultingStoreId: newStore.id,
            actorName: req.user.name,
            actorEmail: req.user.email,
          },
        },
        { transaction: t },
      );

      return { user: newUser, store: newStore };
    });

    try {
      await sendStoreStatusNotice({ store, owner: user, status: 'approved' });
    } catch (mailError) {
      console.error('[mailer] No se pudo notificar la aprobación de la tienda:', mailError.message);
    }

    const updatedApplication = await findApplication(application.id);

    return res.json({
      message:
        'Solicitud aprobada: la tienda ya está publicada y el dueño puede ingresar con su cuenta.',
      application: toApplicationJson(updatedApplication),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      store: { id: store.id, name: store.name, slug: store.slug, status: store.status },
    });
  } catch (error) {
    return next(error);
  }
}

export async function rejectApplication(req, res, next) {
  try {
    const application = await findApplication(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Solicitud no encontrada.' });
    }
    if (application.status !== 'pending') {
      return res.status(409).json({ error: 'Esta solicitud ya fue procesada.' });
    }

    const rejectedReason = req.body?.rejected_reason ?? req.body?.rejectedReason ?? null;
    if (!rejectedReason || typeof rejectedReason !== 'string' || !rejectedReason.trim()) {
      return res.status(400).json({ error: 'rejected_reason es obligatorio al rechazar.' });
    }

    await db.sequelize.transaction(async (t) => {
      await application.update(
        {
          status: 'rejected',
          rejectedReason: rejectedReason.trim(),
          reviewedByUserId: req.user.id,
          reviewedAt: new Date(),
        },
        { transaction: t },
      );

      await db.AuditLog.create(
        {
          actorUserId: req.user.id,
          action: 'reject_application',
          targetType: 'store_application',
          targetId: application.id,
          details: {
            targetName: application.storeName,
            targetSlug: application.slug,
            applicantEmail: application.applicantEmail,
            reason: application.rejectedReason,
            actorName: req.user.name,
            actorEmail: req.user.email,
          },
        },
        { transaction: t },
      );
    });

    try {
      await sendStoreStatusNotice({
        store: { name: application.storeName, slug: application.slug },
        owner: { name: application.applicantName, email: application.applicantEmail },
        status: 'rejected',
        reason: application.rejectedReason,
      });
    } catch (mailError) {
      console.error('[mailer] No se pudo notificar el rechazo de la tienda:', mailError.message);
    }

    const updatedApplication = await findApplication(application.id);

    return res.json({
      message: 'Solicitud rechazada. No se creó una cuenta ni una tienda.',
      application: toApplicationJson(updatedApplication),
    });
  } catch (error) {
    return next(error);
  }
}
