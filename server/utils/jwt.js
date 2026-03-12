const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.warn('[WARN] JWT_SECRET no configurado. Usando clave insegura de desarrollo.');
}
const JWT_SECRET = SECRET || 'taskorbit_dev_secret_change_in_production';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

/**
 * Genera un token JWT firmado
 * @param {Object} payload Datos a incluir en el token
 * @returns {string} Token firmado
 */
const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });
};

/**
 * Verifica y decodifica un token JWT
 * @param {string} token Token a verificar
 * @returns {Object} Payload decodificado
 * @throws {Error} Si el token es inválido o expirado
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  signToken,
  verifyToken,
};
