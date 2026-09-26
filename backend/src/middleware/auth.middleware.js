import { verifyToken } from '../utils/token.util.js';
import db from '../models/index.js';

const PUBLIC_FIELDS = ['id', 'name', 'email', 'role'];

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
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Se requiere rol de administrador.' });
    }
    return next();
  });
}
