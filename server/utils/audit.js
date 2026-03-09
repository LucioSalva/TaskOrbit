const db = require('../config/db');

/**
 * Registra una acción en la auditoría
 * @param {object} client - Cliente de base de datos (opcional, si es null usa el pool global)
 * @param {number} actorId - ID del usuario que realiza la acción (puede ser null para accesos no autorizados)
 * @param {string} action - Acción realizada (e.g., 'UPDATE_USER', 'UNAUTHORIZED_ACCESS')
 * @param {number} targetId - ID del registro afectado (opcional)
 * @param {object|string} details - Detalles adicionales
 * @param {object} extra - Campos extra { ip, method, endpoint, attemptedRole }
 */
const logAudit = async (client, actorId, action, targetId, details, extra = {}) => {
  const query = `
    INSERT INTO audit_logs (actor_id, action, target_id, details, ip_address, method, endpoint, attempted_role)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;
  const detailsString = typeof details === 'object' ? JSON.stringify(details) : details;
  const { ip, method, endpoint, attemptedRole } = extra;
  
  // Construir params manejando valores undefined/null
  const params = [
    actorId, 
    action, 
    targetId, 
    detailsString, 
    ip || null, 
    method || null, 
    endpoint || null, 
    attemptedRole || null
  ];

  try {
    if (client) {
      await client.query(query, params);
    } else {
      await db.query(query, params);
    }
  } catch (err) {
    console.error('Error registrando auditoría:', err);
  }
};

module.exports = { logAudit };
