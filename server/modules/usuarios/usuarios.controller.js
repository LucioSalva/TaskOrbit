const bcrypt = require('bcrypt');
const db = require('../../config/db');
const { success, fail } = require('../../utils/responses');
const { isRequired, minLength, isValidRole, isBoolean, isNumericId } = require('../../utils/validators');
const { logAudit } = require('../../utils/audit');

/**
 * Listar todos los usuarios
 * GET /api/usuarios
 */
const getUsuarios = async (req, res, next) => {
  try {
    const query = 'SELECT * FROM vw_usuarios_roles ORDER BY id DESC';
    const result = await db.query(query);
    return success(res, 'Usuarios obtenidos correctamente', result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear nuevo usuario
 * POST /api/usuarios
 */
const createUsuario = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { nombre_completo, username, telefono, password, rol, activo } = req.body;
    const currentUserRole = req.user.rol;

    // 1. Validaciones de entrada
    const errors = [];
    if (!isRequired(nombre_completo)) errors.push('El nombre completo es requerido');
    if (!isRequired(username)) errors.push('El username es requerido');
    if (!isRequired(telefono)) errors.push('El teléfono es requerido');
    if (!isRequired(password)) errors.push('La contraseña es requerida');
    if (!isRequired(rol)) errors.push('El rol es requerido');
    
    if (username && !minLength(username, 4)) errors.push('El username debe tener al menos 4 caracteres');
    if (password && !minLength(password, 8)) errors.push('La contraseña debe tener al menos 8 caracteres');
    if (rol && !isValidRole(rol)) errors.push('El rol no es válido');
    if (activo !== undefined && !isBoolean(activo)) errors.push('El campo activo debe ser booleano');

    if (errors.length > 0) {
      return fail(res, 'Error de validación', errors, 400);
    }

    // 2. Reglas de negocio (Permisos de creación)
    if (rol === 'GOD' && currentUserRole !== 'GOD') {
      return fail(res, 'Solo GOD puede crear usuarios GOD', null, 403);
    }
    if (currentUserRole === 'USER') {
      return fail(res, 'Usuarios USER no pueden crear usuarios', null, 403);
    }

    // 3. Validar existencia previa de username
    const userCheck = await client.query('SELECT id FROM usuarios WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) {
      return fail(res, 'El nombre de usuario ya está en uso', null, 400);
    }

    // 4. Obtener ID del rol
    const roleQuery = await client.query('SELECT id FROM roles WHERE nombre = $1', [rol]);
    if (roleQuery.rows.length === 0) {
      return fail(res, 'Rol no encontrado en base de datos', null, 400);
    }
    const roleId = roleQuery.rows[0].id;

    // 5. Hash password
    const saltRounds = 12; // Aumentado a 12 según requerimiento
    const salt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(password, salt);

    // INICIO TRANSACCIÓN
    await client.query('BEGIN');

    // Insertar usuario
    const insertUserQuery = `
      INSERT INTO usuarios (nombre_completo, username, telefono, password_hash, activo)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, nombre_completo, activo
    `;
    
    // Si activo no viene, default true
    const isActive = activo !== undefined ? activo : true;

    const userResult = await client.query(insertUserQuery, [
      nombre_completo, 
      username, 
      telefono, 
      passwordHash, 
      isActive
    ]);
    const newUser = userResult.rows[0];

    // Asignar rol en usuarios_roles
    const insertRoleQuery = `
      INSERT INTO usuarios_roles (usuario_id, rol_id)
      VALUES ($1, $2)
    `;
    await client.query(insertRoleQuery, [newUser.id, roleId]);

    // Auditoría
    await logAudit(client, req.user.id, 'CREATE_USER', newUser.id, {
      username: newUser.username,
      nombre_completo: newUser.nombre_completo,
      rol
    });

    await client.query('COMMIT');
    // FIN TRANSACCIÓN

    return success(res, 'Usuario creado exitosamente', { ...newUser, rol }, 201);

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Actualizar usuario
 * PUT /api/usuarios/:id
 */
const updateUsuario = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { nombre_completo, username, telefono, rol, activo, password } = req.body;
    const currentUserRole = req.user.rol;

    // 1. Validaciones de entrada
    if (!isNumericId(id)) {
      return fail(res, 'ID inválido', null, 400);
    }

    const errors = [];
    if (!isRequired(nombre_completo)) errors.push('El nombre completo es requerido');
    if (!isRequired(username)) errors.push('El username es requerido');
    if (!isRequired(telefono)) errors.push('El teléfono es requerido');
    if (!isRequired(rol)) errors.push('El rol es requerido');
    if (activo !== undefined && !isBoolean(activo)) errors.push('El campo activo debe ser booleano');
    
    if (username && !minLength(username, 4)) errors.push('El username debe tener al menos 4 caracteres');
    if (rol && !isValidRole(rol)) errors.push('El rol no es válido');
    if (password && !minLength(password, 8)) errors.push('La contraseña debe tener al menos 8 caracteres');

    if (errors.length > 0) {
      return fail(res, 'Error de validación', errors, 400);
    }

    // 2. Verificar usuario objetivo
    const targetUserQuery = await client.query('SELECT * FROM vw_usuarios_roles WHERE id = $1', [id]);
    if (targetUserQuery.rows.length === 0) {
      return fail(res, 'Usuario no encontrado', null, 404);
    }
    const targetUser = targetUserQuery.rows[0];

    // 3. Reglas de negocio (Edición)
    if (currentUserRole === 'ADMIN' && targetUser.rol === 'GOD') {
      return fail(res, 'ADMIN no puede modificar a GOD', null, 403);
    }
    if (currentUserRole === 'USER') {
      return fail(res, 'Usuarios USER no pueden modificar usuarios', null, 403);
    }
    
    // 4. Validar duplicidad de username si cambia
    if (username !== targetUser.username) {
      const userCheck = await client.query('SELECT id FROM usuarios WHERE username = $1', [username]);
      if (userCheck.rows.length > 0) {
        return fail(res, 'El nombre de usuario ya está en uso', null, 400);
      }
    }

    // INICIO TRANSACCIÓN
    await client.query('BEGIN');

    // Preparar campos de actualización
    let passwordHash = null;
    if (password) {
        const saltRounds = 12;
        const salt = await bcrypt.genSalt(saltRounds);
        passwordHash = await bcrypt.hash(password, salt);
    }

    // Actualizar tabla usuarios
    // Construcción dinámica de query para password opcional
    let updateUserQuery = '';
    let queryParams = [];

    if (passwordHash) {
        updateUserQuery = `
          UPDATE usuarios 
          SET nombre_completo = $1,
              username = $2,
              telefono = $3,
              activo = COALESCE($4, activo),
              password_hash = $5
          WHERE id = $6
        `;
        queryParams = [nombre_completo, username, telefono, activo, passwordHash, id];
    } else {
        updateUserQuery = `
          UPDATE usuarios 
          SET nombre_completo = $1,
              username = $2,
              telefono = $3,
              activo = COALESCE($4, activo)
          WHERE id = $5
        `;
        queryParams = [nombre_completo, username, telefono, activo, id];
    }

    await client.query(updateUserQuery, queryParams);

    // Actualizar rol si cambió
    if (rol !== targetUser.rol) {
      // Validar nuevo rol permisos
      if (rol === 'GOD' && currentUserRole !== 'GOD') {
         throw new Error('Solo GOD puede asignar rol GOD'); // Catch abajo lo maneja o usamos fail y return antes de commit
      }
      
      const roleQuery = await client.query('SELECT id FROM roles WHERE nombre = $1', [rol]);
      if (roleQuery.rows.length === 0) {
        throw new Error('Rol inválido en base de datos');
      }
      const newRoleId = roleQuery.rows[0].id;

      // Actualizar relación
      await client.query('UPDATE usuarios_roles SET rol_id = $1 WHERE usuario_id = $2', [newRoleId, id]);
    }

    // Auditoría
    await logAudit(client, req.user.id, 'UPDATE_USER', id, {
      previous: {
        username: targetUser.username,
        nombre_completo: targetUser.nombre_completo,
        telefono: targetUser.telefono,
        rol: targetUser.rol,
        activo: targetUser.activo
      },
      new: {
        username,
        nombre_completo,
        telefono,
        rol,
        activo
      }
    });

    await client.query('COMMIT');

    // Respuesta con datos frescos
    const freshUser = await client.query('SELECT * FROM vw_usuarios_roles WHERE id = $1', [id]);
    return success(res, 'Usuario actualizado correctamente', freshUser.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    // Manejo de errores específicos lanzados manualmente
    if (error.message === 'Solo GOD puede asignar rol GOD') {
        return fail(res, error.message, null, 403);
    }
    if (error.message === 'Rol inválido en base de datos') {
        return fail(res, error.message, null, 400);
    }
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Cambiar estado (Activar/Desactivar)
 * PATCH /api/usuarios/:id/estado
 */
const toggleEstado = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;
    const currentUserRole = req.user.rol;

    // 1. Validaciones
    if (!isNumericId(id)) {
      return fail(res, 'ID inválido', null, 400);
    }
    if (!isBoolean(activo)) {
      return fail(res, 'Campo activo es requerido y debe ser booleano', null, 400);
    }
    if (currentUserRole === 'USER') {
        return fail(res, 'No tiene permisos para cambiar estado', null, 403);
    }

    // 2. Verificar usuario objetivo
    const targetUserQuery = await db.query('SELECT rol FROM vw_usuarios_roles WHERE id = $1', [id]);
    if (targetUserQuery.rows.length === 0) {
      return fail(res, 'Usuario no encontrado', null, 404);
    }
    const targetUser = targetUserQuery.rows[0];

    // 3. Reglas de negocio
    if (currentUserRole === 'ADMIN' && targetUser.rol === 'GOD') {
        return fail(res, 'ADMIN no puede desactivar a GOD', null, 403);
    }

    // 4. Actualizar
    // Corrijo query
    await db.query('UPDATE usuarios SET activo = $1 WHERE id = $2', [activo, id]);

    // Auditoría (fuera de transacción explícita, usa pool)
    await logAudit(null, req.user.id, 'TOGGLE_STATUS', id, {
      previousStatus: targetUser.activo,
      newStatus: activo
    });

    return success(res, `Usuario ${activo ? 'activado' : 'desactivado'} correctamente`);

  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar usuario físicamente
 * DELETE /api/usuarios/:id
 */
const deleteUsuario = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const currentUserRole = req.user.rol;

    // 1. Validaciones
    if (!isNumericId(id)) {
      return fail(res, 'ID inválido', null, 400);
    }

    // 2. Verificar usuario objetivo
    const targetUserQuery = await client.query('SELECT rol FROM vw_usuarios_roles WHERE id = $1', [id]);
    if (targetUserQuery.rows.length === 0) {
      return fail(res, 'Usuario no encontrado', null, 404);
    }
    const targetUser = targetUserQuery.rows[0];

    // 3. Reglas de negocio
    if (targetUser.rol === 'GOD') {
      return fail(res, 'No se puede eliminar un usuario GOD', null, 403);
    }

    // INICIO TRANSACCIÓN
    await client.query('BEGIN');

    // Eliminar usuario (Cascada elimina rol en usuarios_roles si está configurado, 
    // pero el schema original tenía ON DELETE CASCADE en usuarios_roles)
    await client.query('DELETE FROM usuarios WHERE id = $1', [id]);

    // Auditoría
    await logAudit(client, req.user.id, 'DELETE_USER', id, {
      deletedUserId: id,
      deletedUserRole: targetUser.rol
    });

    await client.query('COMMIT');
    // FIN TRANSACCIÓN

    return success(res, 'Usuario eliminado correctamente');

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

module.exports = {
  getUsuarios,
  createUsuario,
  updateUsuario,
  toggleEstado,
  deleteUsuario
};
