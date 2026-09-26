import bcrypt from 'bcryptjs';
import db from '../models/index.js';
import { signToken } from '../utils/token.util.js';

const SALT_ROUNDS = 10;

async function toPublicUser(user) {
  const store = await db.Store.findOne({
    where: { ownerUserId: user.id },
    attributes: ['id', 'status', 'rejectedReason'],
  });

  const base = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  if (store) {
    base.storeStatus = store.status;
    if (store.status === 'rejected') {
      base.storeRejectedReason = store.rejectedReason;
    }
  }

  return base;
}

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body ?? {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email y password son obligatorios.' });
    }

    const existing = await db.User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await db.User.create({ name, email, passwordHash, role: 'customer' });
    const token = signToken(user);

    return res.status(201).json({ token, user: await toPublicUser(user) });
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son obligatorios.' });
    }

    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = signToken(user);

    return res.json({ token, user: await toPublicUser(user) });
  } catch (error) {
    return next(error);
  }
}

export async function me(req, res, next) {
  try {
    return res.json({ user: await toPublicUser(req.user) });
  } catch (error) {
    return next(error);
  }
}
