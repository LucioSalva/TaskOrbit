const { verifyToken } = require('../utils/jwt');
const db = require('../config/db');
const { normalizeRole, pickHighestRole } = require('../utils/role');

/**
 * Middleware para validar el token JWT y autenticar al usuario
 */
const authMiddleware = async (req, res, next) => {
  try {
    console.info('AuthMiddleware:request', {
      method: req.method,
      path: req.originalUrl
    });
    // 1. Obtener el token del header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.info('AuthMiddleware:missing-token', { path: req.originalUrl });
      return res.status(401).json({ message: 'Token no proporcionado o formato inválido' });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verificar el token
    const decoded = verifyToken(token);
    console.info('AuthMiddleware:token-decoded', { userId: decoded?.id ?? null });

    // 3. Validar que el usuario siga existiendo y esté activo (Seguridad extra)
    const query = `
      SELECT u.id, u.username, u.activo, array_agg(r.nombre) AS roles
      FROM usuarios u
      JOIN usuarios_roles ur ON ur.usuario_id = u.id
      JOIN roles r ON r.id = ur.rol_id
      WHERE u.id = $1
      GROUP BY u.id, u.username, u.activo
    `;
    const result = await db.query(query, [decoded.id]);

    if (result.rows.length === 0) {
      console.info('AuthMiddleware:user-not-found', { userId: decoded?.id ?? null });
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    const user = result.rows[0];
    user.rol = pickHighestRole(user.roles ?? user.rol);

    if (!user.activo) {
      console.info('AuthMiddleware:user-inactive', { userId: user.id, role: user.rol });
      return res.status(403).json({ message: 'Usuario inactivo. Contacte al administrador.' });
    }

    // 4. Adjuntar usuario al request
    req.user = user;
    console.info('AuthMiddleware:authorized', { userId: user.id, role: user.rol });
    next();

  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

module.exports = authMiddleware;
