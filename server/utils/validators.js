/**
 * Valida si un valor existe (no es null, undefined o string vacío)
 * @param {any} value 
 * @returns {boolean}
 */
const isRequired = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    return true;
};

/**
 * Valida longitud mínima de un string
 * @param {string} value 
 * @param {number} length 
 * @returns {boolean}
 */
const minLength = (value, length) => {
    if (!value || typeof value !== 'string') return false;
    return value.length >= length;
};

/**
 * Valida si el rol es válido
 * @param {string} role 
 * @returns {boolean}
 */
const isValidRole = (role) => {
    const validRoles = ['GOD', 'ADMIN', 'USER'];
    return validRoles.includes(role);
};

/**
 * Valida si un valor es booleano
 * @param {any} value 
 * @returns {boolean}
 */
const isBoolean = (value) => {
    return typeof value === 'boolean';
};

/**
 * Valida si un valor es un ID numérico válido
 * @param {any} value 
 * @returns {boolean}
 */
const isNumericId = (value) => {
    if (!value) return false;
    const id = Number(value);
    return !isNaN(id) && Number.isInteger(id) && id > 0;
};

const isValidEstado = (estado) => {
    const validEstados = ['por_hacer', 'haciendo', 'terminada', 'enterado', 'ocupado', 'aceptada'];
    return validEstados.includes(estado);
};

const isValidPrioridad = (prioridad) => {
    const validPrioridades = ['baja', 'media', 'alta', 'critica'];
    return validPrioridades.includes(prioridad);
};

module.exports = {
    isRequired,
    minLength,
    isValidRole,
    isBoolean,
    isNumericId,
    isValidEstado,
    isValidPrioridad
};
