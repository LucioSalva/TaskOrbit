const { Pool } = require('pg');
require('dotenv').config();

// Configuración del pool de conexiones
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Event listeners para el pool
pool.on('connect', () => {
  // console.log('Base de datos conectada');
});

pool.on('error', (err) => {
  console.error('Error inesperado en el cliente de base de datos:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
