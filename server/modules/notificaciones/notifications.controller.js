const db = require('../../config/db');
const { success, fail } = require('../../utils/responses');
const { isRequired, isNumericId } = require('../../utils/validators');
const { registerClient, removeClient, createNotification } = require('./notifications.service');

const listNotifications = async (req, res, next) => {
  try {
    const isAdmin = req.user.rol === 'ADMIN' || req.user.rol === 'GOD';
    const userId = isAdmin && isNumericId(req.query.userId) ? Number(req.query.userId) : req.user.id;
    const query = `
      SELECT id, user_id, type, title, message, severity, channel, entity_type, entity_id, read, status, created_at, delivered_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [userId]);
    return success(res, 'Notificaciones obtenidas', result.rows);
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!isNumericId(id)) {
      return fail(res, 'ID inválido', null, 400);
    }
    const query = `
      UPDATE notifications
      SET read = TRUE
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, type, title, message, severity, channel, entity_type, entity_id, read, status, created_at, delivered_at
    `;
    const result = await db.query(query, [id, req.user.id]);
    if (result.rows.length === 0) {
      return fail(res, 'Notificación no encontrada', null, 404);
    }
    return success(res, 'Notificación actualizada', result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { userId, type, title, message, severity, channel, entityType, entityId } = req.body;
    const errors = [];
    if (!isNumericId(userId)) errors.push('Usuario inválido');
    if (!isRequired(type)) errors.push('Tipo requerido');
    if (!isRequired(title)) errors.push('Título requerido');
    if (!isRequired(message)) errors.push('Mensaje requerido');
    if (errors.length > 0) {
      return fail(res, 'Error de validación', errors, 400);
    }
    const notification = await createNotification({
      userId: Number(userId),
      type,
      title,
      message,
      severity,
      channel,
      entityType,
      entityId: entityId ? Number(entityId) : null
    });
    return success(res, 'Notificación creada', notification, 201);
  } catch (error) {
    next(error);
  }
};

const stream = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const userId = req.user.id;
  registerClient(userId, res);

  res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

  req.on('close', () => {
    removeClient(userId, res);
  });
};

module.exports = {
  listNotifications,
  markRead,
  create,
  stream
};
