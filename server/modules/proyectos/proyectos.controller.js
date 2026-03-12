const db = require('../../config/db');
const { success, fail } = require('../../utils/responses');
const { isRequired, minLength, isNumericId, isValidEstado, isValidPrioridad } = require('../../utils/validators');
const { logAudit } = require('../../utils/audit');
const { createNotification } = require('../notificaciones/notifications.service');
const { normalizeRole } = require('../../utils/role');
const { calculateEstimatedMinutes } = require('../../utils/dateHelper');

const mapDbError = (error) => {
  if (!error || !error.code) {
    return null;
  }
  if (error.code === '23503') {
    return { status: 400, message: 'Usuario asignado no existe', detail: error.detail };
  }
  if (error.code === '23502') {
    if (error.column === 'nombre') {
      return { status: 400, message: 'Nombre requerido', detail: error.detail };
    }
    if (error.column === 'usuario_asignado_id') {
      return { status: 400, message: 'Usuario asignado requerido', detail: error.detail };
    }
    return { status: 400, message: 'Faltan campos requeridos', detail: error.detail };
  }
  if (error.code === '23514') {
    if (error.constraint === 'proyectos_prioridad_check') {
      return { status: 400, message: 'Prioridad inválida', detail: error.detail };
    }
    if (error.constraint === 'proyectos_estado_check') {
      return { status: 400, message: 'Estado inválido', detail: error.detail };
    }
    if (error.constraint === 'proyectos_fechas_check') {
      return { status: 400, message: 'Rango de fechas inválido', detail: error.detail };
    }
    return { status: 400, message: 'Validación de datos fallida', detail: error.detail };
  }
  if (error.code === '22P02') {
    return { status: 400, message: 'Formato de dato inválido', detail: error.detail };
  }
  return null;
};

const mapProyectoRow = (row) => ({
  id: row.id,
  nombre: row.nombre,
  descripcion: row.descripcion,
  prioridad: row.prioridad,
  estado: row.estado,
  fechaInicio: row.fecha_inicio,
  fechaFin: row.fecha_fin,
  estimacionMinutos: row.estimacion_minutos,
  usuarioAsignadoId: row.usuario_asignado_id,
  createdBy: row.created_by,
  usuarioAsignadoNombre: row.usuario_asignado_nombre,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const resolveRole = (req) => {
  const normalized = normalizeRole(req?.user?.rol);
  if (req?.user) {
    req.user.rol = normalized;
  }
  return normalized;
};

const getUserRoleById = async (client, userId) => {
  const result = await client.query(
    `SELECT r.nombre AS rol
     FROM usuarios_roles ur
     JOIN roles r ON r.id = ur.rol_id
     WHERE ur.usuario_id = $1
     ORDER BY CASE
       WHEN UPPER(r.nombre) LIKE '%GOD%' THEN 1
       WHEN UPPER(r.nombre) LIKE 'ADMIN%' OR UPPER(r.nombre) LIKE '%ADMINISTR%' OR UPPER(r.nombre) = 'ADM' THEN 2
       WHEN UPPER(r.nombre) LIKE 'USER%' OR UPPER(r.nombre) LIKE 'USUARIO%' OR UPPER(r.nombre) LIKE 'USUAR%' THEN 3
       ELSE 99
     END
     LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return normalizeRole(result.rows[0].rol);
};

const getProyectos = async (req, res, next) => {
  try {
    const role = resolveRole(req);
    console.info('Proyectos:getProyectos:request', {
      userId: req.user.id,
      role,
      dashboard: req.query.dashboard === '1'
    });
    if (!['USER', 'ADMIN', 'GOD'].includes(role)) {
      console.info('Proyectos:getProyectos:denied', { userId: req.user.id, role });
      return fail(res, 'Acceso denegado', null, 403);
    }
    const baseQuery = 'SELECT * FROM vw_proyectos';
    const params = [];
    let where = '';
    const isDashboard = req.query.dashboard === '1';
    if (role === 'USER') {
      where = ' WHERE usuario_asignado_id = $1';
      params.push(req.user.id);
    }
    const result = await db.query(`${baseQuery}${where} ORDER BY created_at DESC`, params);
    console.info('Proyectos:getProyectos:result', {
      userId: req.user.id,
      role,
      count: result.rows.length
    });
    if (isDashboard) {
      console.info('dashboard:proyectos', {
        userId: req.user.id,
        rol: role,
        count: result.rows.length
      });
    }
    return success(res, 'Proyectos obtenidos', result.rows.map(mapProyectoRow));
  } catch (error) {
    next(error);
  }
};

const getProyectoById = async (req, res, next) => {
  try {
    const role = resolveRole(req);
    console.info('Proyectos:getProyectoById:request', {
      userId: req.user.id,
      role,
      projectId: req.params.id
    });
    if (!['USER', 'ADMIN', 'GOD'].includes(role)) {
      console.info('Proyectos:getProyectoById:denied', { userId: req.user.id, role });
      return fail(res, 'Acceso denegado', null, 403);
    }
    const id = Number(req.params.id);
    if (!isNumericId(id)) {
      return fail(res, 'ID inválido', null, 400);
    }
    const result = await db.query('SELECT * FROM vw_proyectos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return fail(res, 'Proyecto no encontrado', null, 404);
    }
    const proyecto = result.rows[0];
    if (role === 'USER' && proyecto.usuario_asignado_id !== req.user.id) {
      console.info('Proyectos:getProyectoById:forbidden', {
        userId: req.user.id,
        role,
        assignedUserId: proyecto.usuario_asignado_id
      });
      return fail(res, 'Acceso denegado', null, 403);
    }
    console.info('Proyectos:getProyectoById:allowed', { userId: req.user.id, role, id });
    return success(res, 'Proyecto obtenido', mapProyectoRow(proyecto));
  } catch (error) {
    next(error);
  }
};

const createProyecto = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const role = resolveRole(req);
    if (!['ADMIN', 'GOD'].includes(role)) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    const {
      nombre,
      descripcion,
      prioridad = 'media',
      estado = 'por_hacer',
      fechaInicio,
      fechaFin,
      usuarioAsignadoId: requestedUserId
    } = req.body;
    const estadoFinal = role === 'ADMIN' ? 'por_hacer' : estado;
    const estimatedMinutes = calculateEstimatedMinutes(fechaInicio, fechaFin);
    const isAdminOrGod = role === 'ADMIN' || role === 'GOD';
    let usuarioAsignadoId = req.user.id;
    if (requestedUserId !== undefined && requestedUserId !== null) {
      if (!isNumericId(requestedUserId)) {
        return fail(res, 'Usuario asignado inválido', null, 400);
      }
      if (!isAdminOrGod && requestedUserId !== req.user.id) {
        return fail(res, 'No tienes permisos para asignar este proyecto', null, 403);
      }
      usuarioAsignadoId = Number(requestedUserId);
    }

    const errors = [];
    if (!isRequired(nombre) || !minLength(nombre, 3)) errors.push('Nombre inválido');
    if (!isNumericId(usuarioAsignadoId)) errors.push('Usuario asignado inválido');
    if (!isValidPrioridad(prioridad)) errors.push('Prioridad inválida');
    if (!isValidEstado(estadoFinal)) errors.push('Estado inválido');
    if (fechaInicio && fechaFin && new Date(fechaFin) <= new Date(fechaInicio)) {
      errors.push('Rango de fechas inválido');
    }
    if (errors.length > 0) {
      return fail(res, 'Error de validación', errors, 400);
    }
    if (isAdminOrGod) {
      const assignedRole = await getUserRoleById(client, usuarioAsignadoId);
      if (!assignedRole) {
        return fail(res, 'Usuario asignado no existe', null, 400);
      }
      if (assignedRole === 'GOD') {
        return fail(res, 'No se puede asignar proyectos a usuario GOD', null, 403);
      }
    }
    if (role === 'GOD' && usuarioAsignadoId === req.user.id) {
      return fail(res, 'No se puede asignar proyectos a usuario GOD', null, 403);
    }

    await client.query('BEGIN');
    const insertQuery = `
      INSERT INTO proyectos
        (nombre, descripcion, prioridad, estado, fecha_inicio, fecha_fin, estimacion_minutos, usuario_asignado_id, created_by)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    const insertResult = await client.query(insertQuery, [
      nombre,
      descripcion || null,
      prioridad,
      estadoFinal,
      fechaInicio || null,
      fechaFin || null,
      estimatedMinutes || null,
      usuarioAsignadoId,
      req.user.id
    ]);

    const proyectoId = insertResult.rows[0].id;
    await logAudit(client, req.user.id, 'PROYECTO_CREATE', proyectoId, {
      nombre,
      usuarioAsignadoId,
      prioridad,
      estado: estadoFinal
    });
    await client.query('COMMIT');

    const result = await db.query('SELECT * FROM vw_proyectos WHERE id = $1', [proyectoId]);
    const proyecto = mapProyectoRow(result.rows[0]);

    const title = 'Nuevo proyecto asignado';
    const message = `Se te asignó el proyecto "${proyecto.nombre}".`;
    const channels = ['in_app', 'email', 'push'];
    for (const channel of channels) {
      try {
        await createNotification({
          userId: proyecto.usuarioAsignadoId,
          type: 'asignacion_proyecto',
          title,
          message,
          severity: 'info',
          channel,
          entityType: 'proyecto',
          entityId: proyecto.id
        });
      } catch (notificationError) {
        console.error('Error creando notificación de proyecto:', notificationError);
      }
    }

    return success(res, 'Proyecto creado', proyecto, 201);
  } catch (error) {
    await client.query('ROLLBACK');
    const mapped = mapDbError(error);
    if (mapped) {
      return fail(res, mapped.message, mapped.detail || null, mapped.status);
    }
    next(error);
  } finally {
    client.release();
  }
};

const updateProyecto = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const role = resolveRole(req);
    if (!['ADMIN', 'GOD'].includes(role)) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    const id = Number(req.params.id);
    if (!isNumericId(id)) {
      return fail(res, 'ID inválido', null, 400);
    }
    const currentResult = await client.query('SELECT * FROM proyectos WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (currentResult.rows.length === 0) {
      return fail(res, 'Proyecto no encontrado', null, 404);
    }
    const current = currentResult.rows[0];

    if (role === 'USER' && current.usuario_asignado_id !== req.user.id) {
      return fail(res, 'Acceso denegado', null, 403);
    }

    const {
      nombre,
      descripcion,
      prioridad,
      estado,
      fechaInicio,
      fechaFin,
      usuarioAsignadoId
    } = req.body;
    if (role === 'USER') {
      const hasForbiddenFields = [nombre, descripcion, prioridad, fechaInicio, fechaFin, usuarioAsignadoId].some(
        (value) => value !== undefined
      );
      if (hasForbiddenFields) {
        return fail(res, 'No tienes permisos para editar este proyecto', null, 403);
      }
      if (estado === undefined) {
        return fail(res, 'No hay cambios para actualizar', null, 400);
      }
    }

    const errors = [];
    if (nombre !== undefined && (!isRequired(nombre) || !minLength(nombre, 3))) errors.push('Nombre inválido');
    if (usuarioAsignadoId !== undefined && !isNumericId(usuarioAsignadoId)) errors.push('Usuario asignado inválido');
    if (prioridad !== undefined && !isValidPrioridad(prioridad)) errors.push('Prioridad inválida');
    if (estado !== undefined && !isValidEstado(estado)) errors.push('Estado inválido');
    const fechaInicioFinal = fechaInicio !== undefined ? fechaInicio : current.fecha_inicio;
    const fechaFinFinal = fechaFin !== undefined ? fechaFin : current.fecha_fin;
    if (fechaInicioFinal && fechaFinFinal && new Date(fechaFinFinal) <= new Date(fechaInicioFinal)) {
      errors.push('Rango de fechas inválido');
    }
    if (errors.length > 0) {
      return fail(res, 'Error de validación', errors, 400);
    }
    if (usuarioAsignadoId !== undefined) {
      const assignedRole = await getUserRoleById(client, usuarioAsignadoId);
      if (!assignedRole) {
        return fail(res, 'Usuario asignado no existe', null, 400);
      }
      if (assignedRole === 'GOD') {
        return fail(res, 'No se puede asignar proyectos a usuario GOD', null, 403);
      }
    }
    const datesChanged = fechaInicio !== undefined || fechaFin !== undefined;
    const estimatedMinutes = datesChanged
      ? calculateEstimatedMinutes(fechaInicioFinal, fechaFinFinal)
      : undefined;

    await client.query('BEGIN');
    const fields = [];
    const params = [];
    let idx = 1;

    const addField = (name, value) => {
      fields.push(`${name} = $${idx}`);
      params.push(value);
      idx += 1;
    };

    if (nombre !== undefined) addField('nombre', nombre);
    if (descripcion !== undefined) addField('descripcion', descripcion);
    if (prioridad !== undefined) addField('prioridad', prioridad);
    if (estado !== undefined) addField('estado', estado);
    if (fechaInicio !== undefined) addField('fecha_inicio', fechaInicio);
    if (fechaFin !== undefined) addField('fecha_fin', fechaFin);
    if (estimatedMinutes !== undefined) addField('estimacion_minutos', estimatedMinutes);
    if (usuarioAsignadoId !== undefined) addField('usuario_asignado_id', usuarioAsignadoId);

    if (fields.length === 0) {
      return fail(res, 'No hay cambios para actualizar', null, 400);
    }

    params.push(id);
    const updateQuery = `UPDATE proyectos SET ${fields.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING id`;
    await client.query(updateQuery, params);

    await logAudit(client, req.user.id, 'PROYECTO_UPDATE', id, {
      before: current,
      after: { nombre, descripcion, prioridad, estado, fechaInicio, fechaFin, estimacionMinutos: estimatedMinutes, usuarioAsignadoId }
    });
    await client.query('COMMIT');

    const result = await db.query('SELECT * FROM vw_proyectos WHERE id = $1', [id]);
    const proyecto = mapProyectoRow(result.rows[0]);

    if (estado && current.estado !== estado) {
      const title = 'Estado de proyecto actualizado';
      const message = `El proyecto "${proyecto.nombre}" cambió a ${estado}.`;
      const channels = ['in_app', 'email', 'push'];
      for (const channel of channels) {
        try {
          await createNotification({
            userId: proyecto.usuarioAsignadoId,
            type: 'asignacion_proyecto',
            title,
            message,
            severity: 'info',
            channel,
            entityType: 'proyecto',
            entityId: proyecto.id
          });
        } catch (notificationError) {
          console.error('Error creando notificación de proyecto:', notificationError);
        }
      }
    }

    return success(res, 'Proyecto actualizado', proyecto);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

const getProyectoDeletePreview = async (req, res, next) => {
  try {
    const role = resolveRole(req);
    if (!['ADMIN', 'GOD'].includes(role)) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    const id = Number(req.params.id);
    if (!isNumericId(id)) {
      return fail(res, 'ID inválido', null, 400);
    }
    const projectResult = await db.query('SELECT * FROM proyectos WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (projectResult.rows.length === 0) {
      return fail(res, 'Proyecto no encontrado', null, 404);
    }
    const tasksResult = await db.query(
      'SELECT COUNT(*)::int AS total FROM tareas WHERE proyecto_id = $1 AND deleted_at IS NULL',
      [id]
    );
    const subtasksResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM subtareas s
       JOIN tareas t ON t.id = s.tarea_id
       WHERE t.proyecto_id = $1 AND t.deleted_at IS NULL AND s.deleted_at IS NULL`,
      [id]
    );
    const projectNotesResult = await db.query(
      'SELECT COUNT(*)::int AS total FROM notas WHERE scope = $1 AND referencia_id = $2 AND deleted_at IS NULL',
      ['proyecto', id]
    );
    const taskNotesResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM notas
       WHERE scope = 'tarea'
         AND deleted_at IS NULL
         AND referencia_id IN (
           SELECT id FROM tareas WHERE proyecto_id = $1 AND deleted_at IS NULL
         )`,
      [id]
    );
    const subtaskNotesResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM notas
       WHERE scope = 'subtarea'
         AND deleted_at IS NULL
         AND referencia_id IN (
           SELECT s.id
           FROM subtareas s
           JOIN tareas t ON t.id = s.tarea_id
           WHERE t.proyecto_id = $1 AND t.deleted_at IS NULL AND s.deleted_at IS NULL
         )`,
      [id]
    );
    return success(res, 'Resumen de eliminación', {
      project: mapProyectoRow(projectResult.rows[0]),
      tasks: tasksResult.rows[0].total,
      subtasks: subtasksResult.rows[0].total,
      notes: {
        proyecto: projectNotesResult.rows[0].total,
        tarea: taskNotesResult.rows[0].total,
        subtarea: subtaskNotesResult.rows[0].total
      }
    });
  } catch (error) {
    next(error);
  }
};

const deleteProyecto = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const role = resolveRole(req);
    if (!['ADMIN', 'GOD'].includes(role)) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    const id = Number(req.params.id);
    const reason = req.body?.reason || req.query?.reason || null;
    if (!isNumericId(id)) {
      return fail(res, 'ID inválido', null, 400);
    }
    const currentResult = await client.query('SELECT * FROM proyectos WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (currentResult.rows.length === 0) {
      return fail(res, 'Proyecto no encontrado', null, 404);
    }
    await client.query('BEGIN');
    const deletedAt = new Date();
    const taskRows = await client.query(
      'SELECT id FROM tareas WHERE proyecto_id = $1 AND deleted_at IS NULL',
      [id]
    );
    const taskIds = taskRows.rows.map((row) => row.id);
    const subtaskRows = await client.query(
      `SELECT s.id
       FROM subtareas s
       JOIN tareas t ON t.id = s.tarea_id
       WHERE t.proyecto_id = $1 AND t.deleted_at IS NULL AND s.deleted_at IS NULL`,
      [id]
    );
    const subtaskIds = subtaskRows.rows.map((row) => row.id);

    await client.query('UPDATE proyectos SET deleted_at = $1 WHERE id = $2', [deletedAt, id]);
    const tareasResult = await client.query(
      'UPDATE tareas SET deleted_at = $1 WHERE proyecto_id = $2 AND deleted_at IS NULL RETURNING id',
      [deletedAt, id]
    );
    const subtareasResult = await client.query(
      `UPDATE subtareas SET deleted_at = $1
       WHERE tarea_id IN (SELECT id FROM tareas WHERE proyecto_id = $2)
         AND deleted_at IS NULL
       RETURNING id`,
      [deletedAt, id]
    );
    const notasProyectoResult = await client.query(
      'UPDATE notas SET deleted_at = $1 WHERE scope = $2 AND referencia_id = $3 AND deleted_at IS NULL RETURNING id',
      [deletedAt, 'proyecto', id]
    );
    let notasTareasResult = { rows: [] };
    let notasSubtareasResult = { rows: [] };
    if (taskIds.length > 0) {
      notasTareasResult = await client.query(
        'UPDATE notas SET deleted_at = $1 WHERE scope = $2 AND referencia_id = ANY($3) AND deleted_at IS NULL RETURNING id',
        [deletedAt, 'tarea', taskIds]
      );
    }
    if (subtaskIds.length > 0) {
      notasSubtareasResult = await client.query(
        'UPDATE notas SET deleted_at = $1 WHERE scope = $2 AND referencia_id = ANY($3) AND deleted_at IS NULL RETURNING id',
        [deletedAt, 'subtarea', subtaskIds]
      );
    }
    await logAudit(client, req.user.id, 'PROYECTO_CASCADE_DELETE', id, {
      reason,
      deletedAt,
      tareas: tareasResult.rows.length,
      subtareas: subtareasResult.rows.length,
      notasProyecto: notasProyectoResult.rows.length,
      notasTareas: notasTareasResult.rows.length,
      notasSubtareas: notasSubtareasResult.rows.length
    });
    await client.query('COMMIT');
    return success(res, 'Proyecto eliminado', {
      id,
      tareas: tareasResult.rows.length,
      subtareas: subtareasResult.rows.length,
      notasProyecto: notasProyectoResult.rows.length,
      notasTareas: notasTareasResult.rows.length,
      notasSubtareas: notasSubtareasResult.rows.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

module.exports = {
  getProyectos,
  getProyectoById,
  createProyecto,
  updateProyecto,
  getProyectoDeletePreview,
  deleteProyecto
};
