const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const dropQuery = `DROP VIEW IF EXISTS vw_proyectos CASCADE;`;

const createQuery = `
CREATE OR REPLACE VIEW vw_proyectos AS
SELECT
    p.id,
    p.nombre,
    p.descripcion,
    p.prioridad,
    p.estado,
    p.fecha_inicio,
    p.fecha_fin,
    p.estimacion_minutos,
    p.usuario_asignado_id,
    p.created_by,
    u.nombre_completo AS usuario_asignado_nombre,
    p.created_at,
    p.updated_at
FROM proyectos p
JOIN usuarios u ON u.id = p.usuario_asignado_id
WHERE p.deleted_at IS NULL;
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('Eliminando vista vw_proyectos...');
    await client.query(dropQuery);
    console.log('Creando vista vw_proyectos...');
    await client.query(createQuery);
    console.log('Vista actualizada correctamente.');
  } catch (error) {
    console.error('Error actualizando la vista:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
