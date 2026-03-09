const db = require('./config/db');

const addIpColumn = async () => {
  const client = await db.pool.connect();
  try {
    console.log('Agregando columna ip_address a audit_logs...');
    await client.query(`
      ALTER TABLE audit_logs 
      ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
      ADD COLUMN IF NOT EXISTS endpoint VARCHAR(255),
      ADD COLUMN IF NOT EXISTS method VARCHAR(10),
      ADD COLUMN IF NOT EXISTS attempted_role VARCHAR(20);
    `);
    console.log('Columnas agregadas exitosamente.');
  } catch (err) {
    console.error('Error alterando tabla audit_logs:', err);
  } finally {
    client.release();
    process.exit();
  }
};

addIpColumn();
