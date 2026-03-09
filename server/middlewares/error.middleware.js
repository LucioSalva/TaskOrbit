const { fail } = require('../utils/responses');

/**
 * Middleware global para manejo de errores
 * @param {Error} err 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error no controlado:', err);

    // Si el error tiene status y mensaje personalizado
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Error interno del servidor';

    // En producción no enviamos el stack trace
    // Aquí podemos decidir si enviar detalle del error o no
    const errorDetail = process.env.NODE_ENV === 'production' ? null : err.stack;

    return fail(res, message, errorDetail, statusCode);
};

module.exports = errorHandler;
