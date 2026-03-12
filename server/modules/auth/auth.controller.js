const bcrypt = require('bcrypt');
const db = require('../../config/db');
const { signToken } = require('../../utils/jwt');
const { success, fail } = require('../../utils/responses');
const { isRequired } = require('../../utils/validators');
const { normalizeRole, pickHighestRole } = require('../../utils/role');

/**
 * Login de usuario
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validaciones
    if (!isRequired(username) || !isRequired(password)) {
      return fail(res, 'Usuario y contraseña son requeridos', null, 400);
    }

    const query = `
      SELECT u.id, u.username, u.password_hash, u.nombre_completo, u.activo, array_agg(r.nombre) AS roles
      FROM usuarios u
      JOIN usuarios_roles ur ON ur.usuario_id = u.id
      JOIN roles r ON r.id = ur.rol_id
      WHERE u.username = $1
      GROUP BY u.id, u.username, u.password_hash, u.nombre_completo, u.activo
    `;
    const result = await db.query(query, [username]);

    if (result.rows.length === 0) {
      return fail(res, 'Credenciales inválidas', null, 401);
    }

    const user = result.rows[0];
    const resolvedRole = pickHighestRole(user.roles ?? user.rol);

    // Validar estado activo
    if (!user.activo) {
      return fail(res, 'Cuenta inactiva. Contacte al administrador.', null, 403);
    }

    // Validar contraseña
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return fail(res, 'Credenciales inválidas', null, 401);
    }

    // Generar Token
    const tokenPayload = {
      id: user.id,
      username: user.username,
      rol: resolvedRole
    };
    const token = signToken(tokenPayload);

    // Responder
    const data = {
      token,
      user: {
        id: user.id,
        username: user.username,
        rol: resolvedRole,
        nombre_completo: user.nombre_completo
      }
    };

    return success(res, 'Login exitoso', data);

  } catch (error) {
    next(error);
  }
};

/**
 * Obtener usuario autenticado
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const query = `
      SELECT u.id, u.username, u.nombre_completo, u.telefono, u.activo, array_agg(r.nombre) AS roles
      FROM usuarios u
      JOIN usuarios_roles ur ON ur.usuario_id = u.id
      JOIN roles r ON r.id = ur.rol_id
      WHERE u.id = $1
      GROUP BY u.id, u.username, u.nombre_completo, u.telefono, u.activo
    `;
    const result = await db.query(query, [req.user.id]);

    if (result.rows.length === 0) {
      return fail(res, 'Usuario no encontrado', null, 404);
    }

    const user = result.rows[0];
    return success(res, 'Datos de usuario obtenidos', {
      ...user,
      rol: pickHighestRole(user.roles ?? user.rol)
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getMe
};
