import nodemailer from 'nodemailer';
import db from '../models/index.js';

export const GMAIL_SMTP_HOST = 'smtp.gmail.com';
export const GMAIL_SMTP_PORT = 465;
export const GMAIL_USER = process.env.GMAIL_USER ?? '';
export const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD ?? '';

export function createGmailTransporter() {
  return nodemailer.createTransport({
    host: GMAIL_SMTP_HOST,
    port: GMAIL_SMTP_PORT,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
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

export { buildStoreApplicationEmail, buildStoreStatusEmail };
