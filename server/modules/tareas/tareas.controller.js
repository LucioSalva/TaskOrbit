const db = require('../../config/db');
const { success, fail } = require('../../utils/responses');
const { isRequired, minLength, isNumericId, isValidEstado, isValidPrioridad } = require('../../utils/validators');
const { logAudit } = require('../../utils/audit');
const { createNotification } = require('../notificaciones/notifications.service');
const { normalizeRole } = require('../../utils/role');
const { calculateEstimatedMinutes } = require('../../utils/dateHelper');

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

const mapTareaRow = (row) => ({
  id: row.id,
  proyectoId: row.proyecto_id,
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

const getTareas = async (req, res, next) => {
  try {
    const role = resolveRole(req);
    if (!['USER', 'ADMIN', 'GOD'].includes(role)) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    const proyectoId = req.query.proyectoId ? Number(req.query.proyectoId) : null;
    const isDashboard = req.query.dashboard === '1';
    if (proyectoId && !isNumericId(proyectoId)) {
      return fail(res, 'Proyecto inválido', null, 400);
    }
    const params = [];
    const where = ['t.deleted_at IS NULL', 'p.deleted_at IS NULL'];
    if (proyectoId) {
      where.push(`t.proyecto_id = $${params.length + 1}`);
      params.push(proyectoId);
    }
    if (role === 'USER') {
      const userParam = `$${params.length + 1}`;
      where.push(`(t.usuario_asignado_id = ${userParam} OR (t.usuario_asignado_id IS NULL AND p.usuario_asignado_id = ${userParam}))`);
      params.push(req.user.id);
    }
    const whereClause = `WHERE ${where.join(' AND ')}`;
    const result = await db.query(
      `SELECT
        t.id,
        t.proyecto_id,
        t.nombre,
        t.descripcion,
        t.prioridad,
        t.estado,
        t.fecha_inicio,
        t.fecha_fin,
        t.estimacion_minutos,
        t.created_by,
        COALESCE(t.usuario_asignado_id, p.usuario_asignado_id) AS usuario_asignado_id,
        COALESCE(ut.nombre_completo, up.nombre_completo) AS usuario_asignado_nombre,
        t.created_at,
        t.updated_at
      FROM tareas t
      JOIN proyectos p ON p.id = t.proyecto_id
      LEFT JOIN usuarios ut ON ut.id = t.usuario_asignado_id
      LEFT JOIN usuarios up ON up.id = p.usuario_asignado_id
      ${whereClause}
      ORDER BY t.created_at DESC`,
      params
    );
    if (isDashboard) {
      console.info('dashboard:tareas', {
        userId: req.user.id,
        rol: req.user.rol,
        proyectoId: proyectoId ?? undefined,
        count: result.rows.length
      });
    }
    return success(res, 'Tareas obtenidas', result.rows.map(mapTareaRow));
  } catch (error) {
    next(error);
  }
};

const getTareaById = async (req, res, next) => {
  try {
    const role = resolveRole(req);
    if (!['USER', 'ADMIN', 'GOD'].includes(role)) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    const id = Number(req.params.id);
    if (!isNumericId(id)) {
      return fail(res, 'ID inválido', null, 400);
    }
    const result = await db.query(
      `SELECT
        t.id,
        t.proyecto_id,
        t.nombre,
        t.descripcion,
        t.prioridad,
        t.estado,
        t.fecha_inicio,
        t.fecha_fin,
        t.estimacion_minutos,
        t.created_by,
        p.created_by AS proyecto_created_by,
        p.usuario_asignado_id AS proyecto_usuario_asignado_id,
        COALESCE(t.usuario_asignado_id, p.usuario_asignado_id) AS usuario_asignado_id,
        COALESCE(ut.nombre_completo, up.nombre_completo) AS usuario_asignado_nombre,
        t.created_at,
        t.updated_at
      FROM tareas t
      JOIN proyectos p ON p.id = t.proyecto_id
      LEFT JOIN usuarios ut ON ut.id = t.usuario_asignado_id
      LEFT JOIN usuarios up ON up.id = p.usuario_asignado_id
      WHERE t.id = $1 AND t.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [id]
    );
    if (result.rows.length === 0) {
      return fail(res, 'Tarea no encontrada', null, 404);
    }
    const tarea = result.rows[0];
    if (role === 'USER' && tarea.usuario_asignado_id !== req.user.id) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    return success(res, 'Tarea obtenida', mapTareaRow(tarea));
  } catch (error) {
    next(error);
  }
};

const createTarea = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const role = resolveRole(req);
    if (!['ADMIN', 'GOD'].includes(role)) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    const {
      proyectoId,
      nombre,
      descripcion,
      prioridad = 'media',
      estado = 'por_hacer',
      fechaInicio,
      fechaFin,
      estimacionMinutos,
      usuarioAsignadoId: requestedUserId
    } = req.body;
    const estimatedMinutes = estimacionMinutos !== undefined
      ? estimacionMinutos
      : calculateEstimatedMinutes(fechaInicio, fechaFin);
    if (requestedUserId !== undefined && requestedUserId !== null && !isNumericId(requestedUserId)) {
      return fail(res, 'Usuario asignado inválido', null, 400);
    }

    const errors = [];
    if (!isNumericId(proyectoId)) errors.push('Proyecto inválido');
    if (!isRequired(nombre) || !minLength(nombre, 3)) errors.push('Nombre inválido');
    if (requestedUserId !== undefined && requestedUserId !== null && !isNumericId(requestedUserId)) {
      errors.push('Usuario asignado inválido');
    }
    if (!isValidPrioridad(prioridad)) errors.push('Prioridad inválida');
    if (!isValidEstado(estado)) errors.push('Estado inválido');
    if (fechaInicio && fechaFin && new Date(fechaFin) <= new Date(fechaInicio)) {
      errors.push('Rango de fechas inválido');
    }
    if (errors.length > 0) {
      return fail(res, 'Error de validación', errors, 400);
    }

    const proyectoResult = await client.query(
      'SELECT id, usuario_asignado_id, created_by, fecha_inicio, fecha_fin FROM proyectos WHERE id = $1 AND deleted_at IS NULL',
      [proyectoId]
    );
    if (proyectoResult.rows.length === 0) {
      return fail(res, 'Proyecto no encontrado', null, 404);
    }
    const proyecto = proyectoResult.rows[0];

    // Validar que las fechas de la tarea estén dentro del rango del proyecto
    if (fechaInicio || fechaFin) {
      const proyInicio = proyecto.fecha_inicio ? new Date(proyecto.fecha_inicio).toISOString().split('T')[0] : null;
      const proyFin = proyecto.fecha_fin ? new Date(proyecto.fecha_fin).toISOString().split('T')[0] : null;
      if (fechaInicio && proyInicio && fechaInicio < proyInicio) {
        return fail(res, 'La fecha de inicio de la tarea no puede ser anterior al inicio del proyecto', null, 400);
      }
      if (fechaFin && proyFin && fechaFin > proyFin) {
        return fail(res, 'La fecha de fin de la tarea no puede ser posterior al fin del proyecto', null, 400);
      }
    }

    if (requestedUserId !== undefined && requestedUserId !== null) {
      const assignedRole = await getUserRoleById(client, requestedUserId);
      if (!assignedRole) {
        return fail(res, 'Usuario asignado no existe', null, 400);
      }
      if (assignedRole === 'GOD') {
        return fail(res, 'No se puede asignar tareas a usuario GOD', null, 403);
      }
    }
    const storedAssignedUserId = requestedUserId ?? null;

    await client.query('BEGIN');
    const insertQuery = `
      INSERT INTO tareas
        (proyecto_id, nombre, descripcion, prioridad, estado, fecha_inicio, fecha_fin, estimacion_minutos, usuario_asignado_id, created_by)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;
    const insertResult = await client.query(insertQuery, [
      proyectoId,
      nombre,
      descripcion || null,
      prioridad,
      estado,
      fechaInicio || null,
      fechaFin || null,
      estimatedMinutes || null,
      storedAssignedUserId,
      req.user.id
    ]);

    const tareaId = insertResult.rows[0].id;
    await logAudit(client, req.user.id, 'TAREA_CREATE', tareaId, {
      nombre,
      proyectoId,
      usuarioAsignadoId: storedAssignedUserId,
      prioridad,
      estado
    });
    await client.query('COMMIT');

    const result = await db.query(
      `SELECT
        t.id,
        t.proyecto_id,
        t.nombre,
        t.descripcion,
        t.prioridad,
        t.estado,
        t.fecha_inicio,
        t.fecha_fin,
        t.estimacion_minutos,
        t.created_by,
        COALESCE(t.usuario_asignado_id, p.usuario_asignado_id) AS usuario_asignado_id,
        COALESCE(ut.nombre_completo, up.nombre_completo) AS usuario_asignado_nombre,
        t.created_at,
        t.updated_at
      FROM tareas t
      JOIN proyectos p ON p.id = t.proyecto_id
      LEFT JOIN usuarios ut ON ut.id = t.usuario_asignado_id
      LEFT JOIN usuarios up ON up.id = p.usuario_asignado_id
      WHERE t.id = $1 AND t.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [tareaId]
    );
    const tarea = mapTareaRow(result.rows[0]);

    if (tarea.usuarioAsignadoId) {
      const title = 'Nueva tarea asignada';
      const message = `Se te asignó la tarea "${tarea.nombre}".`;
      const channels = ['in_app', 'email', 'push'];
      for (const channel of channels) {
        await createNotification({
          userId: tarea.usuarioAsignadoId,
          type: 'asignacion_tarea',
          title,
          message,
          severity: 'info',
          channel,
          entityType: 'tarea',
          entityId: tarea.id
        });
      }
    }

    return success(res, 'Tarea creada', tarea, 201);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

const updateTarea = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const role = resolveRole(req);
    if (!['USER', 'ADMIN', 'GOD'].includes(role)) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    const id = Number(req.params.id);
    if (!isNumericId(id)) {
      return fail(res, 'ID inválido', null, 400);
    }
    const currentResult = await client.query(
      'SELECT t.*, p.usuario_asignado_id AS proyecto_usuario_asignado_id, p.created_by AS proyecto_created_by, p.fecha_inicio AS proyecto_fecha_inicio, p.fecha_fin AS proyecto_fecha_fin FROM tareas t JOIN proyectos p ON p.id = t.proyecto_id WHERE t.id = $1 AND t.deleted_at IS NULL AND p.deleted_at IS NULL',
      [id]
    );
    if (currentResult.rows.length === 0) {
      return fail(res, 'Tarea no encontrada', null, 404);
    }
    const current = currentResult.rows[0];

    const effectiveAssignedUserId = current.usuario_asignado_id ?? current.proyecto_usuario_asignado_id;
    const {
      nombre,
      descripcion,
      prioridad,
      estado,
      fechaInicio,
      fechaFin,
      estimacionMinutos,
      usuarioAsignadoId
    } = req.body;
    if (role === 'USER') {
      if (effectiveAssignedUserId !== req.user.id) {
        return fail(res, 'Acceso denegado', null, 403);
      }
      const hasNonStateChanges = [
        nombre,
        descripcion,
        prioridad,
        fechaInicio,
        fechaFin,
        estimacionMinutos,
        usuarioAsignadoId
      ].some((value) => value !== undefined);
      if (hasNonStateChanges) {
        return fail(res, 'Acceso denegado', null, 403);
      }
      if (estado === undefined) {
        return fail(res, 'Estado requerido', null, 400);
      }
    }
    if (usuarioAsignadoId !== undefined && usuarioAsignadoId !== null && usuarioAsignadoId !== effectiveAssignedUserId) {
      return fail(res, 'No tienes permisos para reasignar esta tarea', null, 403);
    }

    const errors = [];
    if (nombre !== undefined && (!isRequired(nombre) || !minLength(nombre, 3))) errors.push('Nombre inválido');
    if (usuarioAsignadoId !== undefined && usuarioAsignadoId !== null && !isNumericId(usuarioAsignadoId)) {
      errors.push('Usuario asignado inválido');
    }
    if (prioridad !== undefined && !isValidPrioridad(prioridad)) errors.push('Prioridad inválida');
    if (estado !== undefined && !isValidEstado(estado)) errors.push('Estado inválido');
    const datesChanged = fechaInicio !== undefined || fechaFin !== undefined;
    const fechaInicioFinal = fechaInicio !== undefined ? fechaInicio : current.fecha_inicio;
    const fechaFinFinal = fechaFin !== undefined ? fechaFin : current.fecha_fin;
    if (fechaInicioFinal && fechaFinFinal && new Date(fechaFinFinal) <= new Date(fechaInicioFinal)) {
      errors.push('Rango de fechas inválido');
    }
    // Validar fechas de tarea dentro del rango del proyecto
    if (datesChanged) {
      const proyInicio = current.proyecto_fecha_inicio ? new Date(current.proyecto_fecha_inicio).toISOString().split('T')[0] : null;
      const proyFin = current.proyecto_fecha_fin ? new Date(current.proyecto_fecha_fin).toISOString().split('T')[0] : null;
      const newInicio = fechaInicioFinal ? new Date(fechaInicioFinal).toISOString().split('T')[0] : null;
      const newFin = fechaFinFinal ? new Date(fechaFinFinal).toISOString().split('T')[0] : null;
      if (newInicio && proyInicio && newInicio < proyInicio) {
        errors.push('La fecha de inicio de la tarea no puede ser anterior al inicio del proyecto');
      }
      if (newFin && proyFin && newFin > proyFin) {
        errors.push('La fecha de fin de la tarea no puede ser posterior al fin del proyecto');
      }
    }
    const estimatedMinutes = estimacionMinutos !== undefined
      ? estimacionMinutos
      : (datesChanged ? calculateEstimatedMinutes(fechaInicioFinal, fechaFinFinal) : undefined);
    if (errors.length > 0) {
      return fail(res, 'Error de validación', errors, 400);
    }

    if (usuarioAsignadoId !== undefined && usuarioAsignadoId !== null) {
      const assignedRole = await getUserRoleById(client, usuarioAsignadoId);
      if (!assignedRole) {
        return fail(res, 'Usuario asignado no existe', null, 400);
      }
      if (assignedRole === 'GOD') {
        return fail(res, 'No se puede asignar tareas a usuario GOD', null, 403);
      }
    }

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
    if (datesChanged || estimacionMinutos !== undefined) addField('estimacion_minutos', estimatedMinutes ?? null);
    if (usuarioAsignadoId !== undefined) addField('usuario_asignado_id', usuarioAsignadoId);

    if (fields.length === 0) {
      return fail(res, 'No hay cambios para actualizar', null, 400);
    }

    params.push(id);
    const updateQuery = `UPDATE tareas SET ${fields.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING id`;
    await client.query(updateQuery, params);

    await logAudit(client, req.user.id, 'TAREA_UPDATE', id, {
      before: current,
      after: { nombre, descripcion, prioridad, estado, fechaInicio, fechaFin, estimacionMinutos: estimatedMinutes, usuarioAsignadoId }
    });
    await client.query('COMMIT');

    const result = await db.query(
      `SELECT
        t.id,
        t.proyecto_id,
        t.nombre,
        t.descripcion,
        t.prioridad,
        t.estado,
        t.fecha_inicio,
        t.fecha_fin,
        t.estimacion_minutos,
        t.created_by,
        COALESCE(t.usuario_asignado_id, p.usuario_asignado_id) AS usuario_asignado_id,
        COALESCE(ut.nombre_completo, up.nombre_completo) AS usuario_asignado_nombre,
        t.created_at,
        t.updated_at
      FROM tareas t
      JOIN proyectos p ON p.id = t.proyecto_id
      LEFT JOIN usuarios ut ON ut.id = t.usuario_asignado_id
      LEFT JOIN usuarios up ON up.id = p.usuario_asignado_id
      WHERE t.id = $1 AND t.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [id]
    );
    const tarea = mapTareaRow(result.rows[0]);

    if (estado && current.estado !== estado && tarea.usuarioAsignadoId) {
      const title = 'Estado de tarea actualizado';
      const message = `La tarea "${tarea.nombre}" cambió a ${estado}.`;
      const channels = ['in_app', 'email', 'push'];
      for (const channel of channels) {
        await createNotification({
          userId: tarea.usuarioAsignadoId,
          type: 'asignacion_tarea',
          title,
          message,
          severity: 'info',
          channel,
          entityType: 'tarea',
          entityId: tarea.id
        });
      }
    }

    return success(res, 'Tarea actualizada', tarea);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

const getTareaDeletePreview = async (req, res, next) => {
  try {
    const role = resolveRole(req);
    if (!['ADMIN', 'GOD'].includes(role)) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    const id = Number(req.params.id);
    if (!isNumericId(id)) {
      return fail(res, 'ID inválido', null, 400);
    }
    const taskResult = await db.query(
      `SELECT t.*, p.usuario_asignado_id AS proyecto_usuario_asignado_id, p.created_by AS proyecto_created_by
       FROM tareas t
       JOIN proyectos p ON p.id = t.proyecto_id
       WHERE t.id = $1 AND t.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [id]
    );
    if (taskResult.rows.length === 0) {
      return fail(res, 'Tarea no encontrada', null, 404);
    }
    const subtasksResult = await db.query(
      'SELECT COUNT(*)::int AS total FROM subtareas WHERE tarea_id = $1 AND deleted_at IS NULL',
      [id]
    );
    const taskNotesResult = await db.query(
      'SELECT COUNT(*)::int AS total FROM notas WHERE scope = $1 AND referencia_id = $2 AND deleted_at IS NULL',
      ['tarea', id]
    );
    const subtaskNotesResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM notas
       WHERE scope = 'subtarea'
         AND deleted_at IS NULL
         AND referencia_id IN (
           SELECT id FROM subtareas WHERE tarea_id = $1 AND deleted_at IS NULL
         )`,
      [id]
    );
    return success(res, 'Resumen de eliminación', {
      task: mapTareaRow(taskResult.rows[0]),
      subtasks: subtasksResult.rows[0].total,
      notes: {
        tarea: taskNotesResult.rows[0].total,
        subtarea: subtaskNotesResult.rows[0].total
      }
    });
  } catch (error) {
    next(error);
  }
};

const deleteTarea = async (req, res, next) => {
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
    const currentResult = await client.query(
      `SELECT t.*, p.usuario_asignado_id AS proyecto_usuario_asignado_id, p.created_by AS proyecto_created_by
       FROM tareas t
       JOIN proyectos p ON p.id = t.proyecto_id
       WHERE t.id = $1 AND t.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [id]
    );
    if (currentResult.rows.length === 0) {
      return fail(res, 'Tarea no encontrada', null, 404);
    }
    await client.query('BEGIN');
    const deletedAt = new Date();
    const subtaskRows = await client.query(
      'SELECT id FROM subtareas WHERE tarea_id = $1 AND deleted_at IS NULL',
      [id]
    );
    const subtaskIds = subtaskRows.rows.map((row) => row.id);
    await client.query('UPDATE tareas SET deleted_at = $1 WHERE id = $2', [deletedAt, id]);
    const subtareasResult = await client.query(
      'UPDATE subtareas SET deleted_at = $1 WHERE tarea_id = $2 AND deleted_at IS NULL RETURNING id',
      [deletedAt, id]
    );
    const notasTareaResult = await client.query(
      'UPDATE notas SET deleted_at = $1 WHERE scope = $2 AND referencia_id = $3 AND deleted_at IS NULL RETURNING id',
      [deletedAt, 'tarea', id]
    );
    let notasSubtareasResult = { rows: [] };
    if (subtaskIds.length > 0) {
      notasSubtareasResult = await client.query(
        'UPDATE notas SET deleted_at = $1 WHERE scope = $2 AND referencia_id = ANY($3) AND deleted_at IS NULL RETURNING id',
        [deletedAt, 'subtarea', subtaskIds]
      );
    }
    await logAudit(client, req.user.id, 'TAREA_CASCADE_DELETE', id, {
      reason,
      deletedAt,
      subtareas: subtareasResult.rows.length,
      notasTarea: notasTareaResult.rows.length,
      notasSubtareas: notasSubtareasResult.rows.length
    });
    await client.query('COMMIT');
    return success(res, 'Tarea eliminada', {
      id,
      subtareas: subtareasResult.rows.length,
      notasTarea: notasTareaResult.rows.length,
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
  getTareas,
  getTareaById,
  createTarea,
  updateTarea,
  getTareaDeletePreview,
  deleteTarea
};
