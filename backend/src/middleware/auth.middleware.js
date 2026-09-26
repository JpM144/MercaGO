import { verifyToken } from '../utils/token.util.js';
import db from '../models/index.js';

const PUBLIC_FIELDS = ['id', 'name', 'email', 'role'];
const ADMIN_ROLES = ['admin', 'super_admin'];

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Falta el token de autenticación.' });
  }

  try {
    const payload = verifyToken(token);
    const user = await db.User.findByPk(payload.sub, { attributes: PUBLIC_FIELDS });

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    req.user = user.get({ plain: true });
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) {
      return next(err);
    }
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Se requiere rol de administrador.' });
    }
    return next();
  });
}

export function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) {
      return next(err);
    }
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Se requiere rol de super administrador.' });
    }
    return next();
  });
}

export function requireStoreAdmin(req, res, next) {
  requireAuth(req, res, async (err) => {
    if (err) {
      return next(err);
    }
    if (req.user?.role !== 'store_admin') {
      return res.status(403).json({ error: 'Se requiere rol de administrador de tienda.' });
    }

    try {
      const store = await db.Store.findOne({
        where: { ownerUserId: req.user.id },
        attributes: ['id', 'name', 'slug', 'status', 'ownerUserId'],
      });
      if (!store) {
        return res.status(403).json({ error: 'No tenés una tienda asociada para administrar.' });
      }
      req.store = store.get({ plain: true });
      return next();
    } catch (error) {
      return next(error);
    }
  });
}

export function requireApprovedStore(req, res, next) {
  if (req.store?.status !== 'approved') {
    return res.status(403).json({
      error:
        'Tu tienda no está aprobada: no podés administrar productos hasta que un super admin la apruebe.',
    });
  }
  return next();
}

export async function requireOwnedProduct(req, res, next) {
  try {
    if (!req.store) {
      return res.status(403).json({ error: 'No tenés una tienda asociada.' });
    }

    const product = await db.Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    if (product.storeId !== req.store.id) {
      return res.status(403).json({ error: 'No podés modificar productos de otra tienda.' });
    }

    req.product = product;
    return next();
  } catch (error) {
    return next(error);
  }
}
