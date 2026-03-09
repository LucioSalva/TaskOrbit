const { logAudit } = require('../utils/audit');

/**
 * Middleware para validar roles permitidos
 * @param {...string} allowedRoles Roles permitidos (ej: 'GOD', 'ADMIN')
 */
const roleMiddleware = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      console.info('RoleMiddleware:missing-user', { path: req.originalUrl });
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      console.info('RoleMiddleware:denied', {
        path: req.originalUrl,
        role: req.user.rol,
        allowedRoles
      });
      // Registrar auditoría de acceso no autorizado
      await logAudit(null, req.user.id, 'UNAUTHORIZED_ACCESS', null, 'Intento de acceso a ruta protegida', {
        ip: req.ip || req.connection.remoteAddress,
        method: req.method,
        endpoint: req.originalUrl,
        attemptedRole: req.user.rol
      });

      return res.status(403).json({ 
        message: 'Acceso Denegado: No tienes permisos suficientes para realizar esta acción.' 
      });
    }

    console.info('RoleMiddleware:allowed', {
      path: req.originalUrl,
      role: req.user.rol,
      allowedRoles
    });
    next();
  };
};

module.exports = roleMiddleware;
