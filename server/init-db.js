const fs = require('fs');
const path = require('path');
const db = require('./config/db'); // Use existing db config
const bcrypt = require('bcrypt');

const initDb = async () => {
  try {
    const sqlPath = path.join(__dirname, 'database.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Ejecutando script SQL...');
    await db.query(sql);

    // Crear usuario por defecto si no existe
    const username = 'admin';
    const password = 'password123';
    const role = 'ADMIN';

    const userCheck = await db.query('SELECT * FROM usuarios WHERE username = $1', [username]);
    if (userCheck.rows.length === 0) {
      console.log(`Creando usuario por defecto: ${username}`);
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      const userResult = await db.query(
        'INSERT INTO usuarios (username, password_hash, nombre_completo, telefono, activo) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [username, hash, 'Administrador del Sistema', '1234567890', true]
      );
      const userId = userResult.rows[0].id;

      const roleResult = await db.query('SELECT id FROM roles WHERE nombre = $1', [role]);
      const roleId = roleResult.rows[0].id;

      await db.query('INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, $2)', [userId, roleId]);
      console.log(`Usuario creado: ${username} / ${password}`);
    } else {
      console.log(`Usuario ${username} ya existe.`);
    }

    const godUsername = 'chingon';
    const godPassword = 'Chingon#2026';
    const godRole = 'GOD';
    const godCheck = await db.query('SELECT id, password_hash FROM usuarios WHERE username = $1', [godUsername]);
    let godId = null;
    if (godCheck.rows.length === 0) {
      const godSalt = await bcrypt.genSalt(10);
      const godHash = await bcrypt.hash(godPassword, godSalt);
      const godResult = await db.query(
        'INSERT INTO usuarios (username, password_hash, nombre_completo, telefono, activo) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [godUsername, godHash, 'Chingon Supremo', '0000000000', true]
      );
      godId = godResult.rows[0].id;
    } else {
      godId = godCheck.rows[0].id;
      const currentHash = godCheck.rows[0].password_hash || '';
      if (!currentHash.startsWith('$2b$')) {
        const godSalt = await bcrypt.genSalt(10);
        const godHash = await bcrypt.hash(godPassword, godSalt);
        await db.query('UPDATE usuarios SET password_hash = $1, activo = TRUE WHERE id = $2', [godHash, godId]);
      }
    }

    await db.query(
      "DELETE FROM usuarios_roles WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'GOD') AND usuario_id <> (SELECT id FROM usuarios WHERE username = $1)",
      [godUsername]
    );

    if (godId) {
      const godRoleResult = await db.query('SELECT id FROM roles WHERE nombre = $1', [godRole]);
      const godRoleId = godRoleResult.rows[0].id;
      await db.query(
        'INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [godId, godRoleId]
      );
    }

    console.log('Base de datos inicializada correctamente.');
    process.exit(0);
  } catch (error) {
    console.error('Error inicializando base de datos:', error);
    process.exit(1);
  }
};

initDb();
