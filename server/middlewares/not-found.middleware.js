const { fail } = require('../utils/responses');

/**
 * Middleware para manejar rutas no encontradas (404)
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
const notFoundHandler = (req, res, next) => {
    return fail(res, `Ruta no encontrada: ${req.method} ${req.originalUrl}`, null, 404);
};

module.exports = notFoundHandler;
