const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const createQuery = `
CREATE OR REPLACE VIEW vw_subtareas AS
SELECT
    s.id,
    s.tarea_id,
    s.nombre,
    s.descripcion,
    s.prioridad,
    s.estado,
    CASE WHEN s.estado = 'terminada' THEN true ELSE false END AS completada,
    s.fecha_inicio,
    s.fecha_fin,
    s.estimacion_minutos,
    s.created_by,
    s.created_at,
    s.updated_at
FROM subtareas s
WHERE s.deleted_at IS NULL;
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('Creando vista vw_subtareas...');
    await client.query(createQuery);
    console.log('Vista vw_subtareas creada correctamente.');
  } catch (error) {
    console.error('Error creando la vista:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
