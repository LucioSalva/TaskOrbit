/**
 * Helper para respuestas de éxito uniformes
 * @param {Object} res - Objeto response de Express
 * @param {string} message - Mensaje descriptivo
 * @param {Object|Array} data - Datos a devolver (opcional)
 * @param {number} statusCode - Código HTTP (default 200)
 */
const success = (res, message, data = null, statusCode = 200) => {
    return res.status(statusCode).json({
        ok: true,
        message,
        data
    });
};

/**
 * Helper para respuestas de error uniformes
 * @param {Object} res - Objeto response de Express
 * @param {string} message - Mensaje de error
 * @param {Object|string} error - Detalle del error (opcional)
 * @param {number} statusCode - Código HTTP (default 500)
 */
const fail = (res, message, error = null, statusCode = 500) => {
    const response = {
        ok: false,
        message
    };

    if (error) {
        response.error = error;
    }

    return res.status(statusCode).json(response);
};

module.exports = {
    success,
    fail
};
