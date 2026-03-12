const db = require('../../config/db');

const clientsByUser = new Map();

const registerClient = (userId, res) => {
  if (!clientsByUser.has(userId)) {
    clientsByUser.set(userId, new Set());
  }
  clientsByUser.get(userId).add(res);
};

const removeClient = (userId, res) => {
  if (!clientsByUser.has(userId)) {
    return;
  }
  const set = clientsByUser.get(userId);
  set.delete(res);
  if (set.size === 0) {
    clientsByUser.delete(userId);
  }
};

const broadcast = (userId, payload) => {
  const set = clientsByUser.get(userId);
  if (!set) {
    return;
  }
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  set.forEach((res) => {
    res.write(data);
  });
};

const createNotification = async ({
  userId,
  type,
  title,
  message,
  severity = 'info',
  channel = 'in_app',
  entityType = null,
  entityId = null
}) => {
  const status = channel === 'in_app' ? 'sent' : 'queued';
  const deliveredAt = channel === 'in_app' ? new Date() : null;
  const query = `
    INSERT INTO notifications
      (user_id, type, title, message, severity, channel, entity_type, entity_id, status, delivered_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id, user_id, type, title, message, severity, channel, entity_type, entity_id, read, status, created_at, delivered_at
  `;
  const params = [userId, type, title, message, severity, channel, entityType, entityId, status, deliveredAt];
  const result = await db.query(query, params);
  const notification = result.rows[0];
  if (channel === 'in_app') {
    broadcast(userId, notification);
  }
  return notification;
};

module.exports = {
  registerClient,
  removeClient,
  broadcast,
  createNotification
};
