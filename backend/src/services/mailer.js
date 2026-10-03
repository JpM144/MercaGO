import nodemailer from 'nodemailer';
import db from '../models/index.js';

// Gmail es el destino por defecto; SMTP_HOST/SMTP_PORT permiten apuntar a otro
// servidor (por ejemplo un buzón de pruebas en la verificación end-to-end).
export const GMAIL_SMTP_HOST = process.env.SMTP_HOST ?? 'smtp.gmail.com';
export const GMAIL_SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
export const GMAIL_USER = process.env.GMAIL_USER ?? '';
export const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD ?? '';

export function createGmailTransporter() {
  const options = {
    host: GMAIL_SMTP_HOST,
    port: GMAIL_SMTP_PORT,
    secure: GMAIL_SMTP_PORT === 465,
  };
  if (GMAIL_USER) {
    options.auth = { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD };
  }
  return nodemailer.createTransport(options);
}

let transporterFactory = createGmailTransporter;
let transporter = null;

export function __setTransporterFactoryForTests(factory) {
  transporterFactory = factory || createGmailTransporter;
  transporter = null;
}

export function getTransporter() {
  if (!transporter) {
    transporter = transporterFactory();
  }
  return transporter;
}

function senderAddress() {
  if (GMAIL_USER) {
    return `TechStore <${GMAIL_USER}>`;
  }
  return 'TechStore <no-reply@techstore.local>';
}

function buildStoreApplicationEmail({ store, owner }) {
  const subject = `Nueva solicitud de tienda: ${store.name}`;
  const text = [
    'Se recibió una nueva solicitud de tienda en TechStore.',
    '',
    `Tienda: ${store.name}`,
    `Descripción: ${store.description || 'Sin descripción'}`,
    `WhatsApp: ${store.whatsappNumber || 'No informado'}`,
    `URL de la tienda: /tienda/${store.slug}`,
    '',
    `Solicitante (dueño): ${owner.name}`,
    `Email de contacto: ${owner.email}`,
    '',
    'Ingresá al panel de administración para revisar la solicitud y aprobarla o rechazarla.',
  ].join('\n');
  return { subject, text };
}

function buildStoreStatusEmail({ store, owner, status, reason }) {
  if (status === 'approved') {
    const subject = `Tu tienda "${store.name}" fue aprobada`;
    const text = [
      `¡Buenas noticias, ${owner.name}!`,
      '',
      `Tu solicitud fue aprobada y tu tienda "${store.name}" ya está publicada en el marketplace.`,
      '',
      'Ya podés ingresar con tu cuenta, cargar los productos de tu catálogo y empezar a recibir ventas por WhatsApp.',
      '',
      `URL de tu tienda: /tienda/${store.slug}`,
    ].join('\n');
    return { subject, text };
  }

  const subject = `Tu solicitud de tienda "${store.name}" fue rechazada`;
  const text = [
    `Hola ${owner.name},`,
    '',
    `Lamentablemente tu solicitud para la tienda "${store.name}" fue rechazada.`,
    '',
    `Motivo del rechazo: ${reason || 'No se informó un motivo.'}`,
    '',
    'Podés corregir lo indicado y volver a enviar una nueva solicitud desde el formulario de alta de tienda.',
  ].join('\n');
  return { subject, text };
}

function buildPlanChangeEmail({ store, owner, status, tierName, reason }) {
  const target = tierName || 'el plan solicitado';

  if (status === 'approved') {
    const subject = `Tu cambio de plan a "${target}" fue aprobado`;
    const text = [
      `¡Buenas noticias, ${owner.name}!`,
      '',
      `Tu solicitud de cambio de plan para la tienda "${store.name}" fue aprobada.`,
      '',
      `Plan actual: ${target}`,
      'El nuevo límite de productos ya está vigente: si tenías bloqueada la publicación de productos por límite, ya podés volver a cargar catálogo.',
      '',
      'Ya registramos el comprobante de la transferencia que adjuntaste y el plan fue actualizado.',
      '',
      'URL de tu tienda: /tienda/' + store.slug,
    ].join('\n');
    return { subject, text };
  }

  const subject = `Tu solicitud de cambio de plan a "${target}" fue rechazada`;
  const text = [
    `Hola ${owner.name},`,
    '',
    `Lamentablemente tu solicitud para pasar al plan ${target} de la tienda "${store.name}" fue rechazada.`,
    '',
    `Motivo del rechazo: ${reason || 'No se informó un motivo.'}`,
    '',
    'Tu tienda mantiene su plan actual.',
    'Podés corregir lo indicado y volver a solicitar un cambio de plan desde el panel.',
  ].join('\n');
  return { subject, text };
}

export async function sendStoreApplicationNotice({ store, owner }) {
  const superAdmins = await db.User.findAll({
    where: { role: 'super_admin' },
    attributes: ['id', 'name', 'email'],
  });
  if (superAdmins.length === 0) {
    return 0;
  }

  const { subject, text } = buildStoreApplicationEmail({ store, owner });
  const to = superAdmins.map((user) => user.email);
  await getTransporter().sendMail({ from: senderAddress(), to, subject, text });
  return to.length;
}

export async function sendStoreStatusNotice({ store, owner, status, reason }) {
  const { subject, text } = buildStoreStatusEmail({ store, owner, status, reason });
  await getTransporter().sendMail({
    from: senderAddress(),
    to: owner.email,
    subject,
    text,
  });
}

export async function sendPlanChangeNotice({ store, owner, status, tierName, reason }) {
  const { subject, text } = buildPlanChangeEmail({ store, owner, status, tierName, reason });
  const info = await getTransporter().sendMail({
    from: senderAddress(),
    to: owner.email,
    subject,
    text,
  });

  if (info?.rejected?.length) {
    console.error(
      `[mailer] Gmail rechazó el aviso de cambio de plan (${status}) para ${owner.email}:`,
      info.rejected.join(', '),
    );
  } else {
    console.log(
      `[mailer] Aviso de cambio de plan (${status}) aceptado por Gmail para ${owner.email}`,
      { messageId: info?.messageId, response: info?.response },
    );
  }

  return info;
}

export { buildStoreApplicationEmail, buildStoreStatusEmail, buildPlanChangeEmail };
