const db = require('./config/db');

const createAuditTable = async () => {
  const client = await db.pool.connect();
  try {
    console.log('Creando tabla de auditoría...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        actor_id INTEGER, -- Quién hizo el cambio
        action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, TOGGLE_STATUS
        target_id INTEGER, -- A quién se le hizo el cambio
        details TEXT, -- Descripción o JSON
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabla audit_logs creada o ya existente.');
  } catch (err) {
    console.error('Error creando tabla audit_logs:', err);
  } finally {
    client.release();
    process.exit();
  }
};

createAuditTable();
