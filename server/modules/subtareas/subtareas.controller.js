const db = require('../../config/db');
const { success, fail } = require('../../utils/responses');
const { isRequired, minLength, isNumericId, isValidEstado, isValidPrioridad } = require('../../utils/validators');
const { logAudit } = require('../../utils/audit');
const { normalizeRole } = require('../../utils/role');
const { calculateEstimatedMinutes } = require('../../utils/dateHelper');

const resolveRole = (req) => {
  const normalized = normalizeRole(req?.user?.rol);
  if (req?.user) {
    req.user.rol = normalized;
  }
  return normalized;
};

const mapSubtareaRow = (row) => ({
  id: row.id,
  tareaId: row.tarea_id,
  nombre: row.nombre,
  descripcion: row.descripcion,
  prioridad: row.prioridad,
  estado: row.estado,
  fechaInicio: row.fecha_inicio,
  fechaFin: row.fecha_fin,
  estimacionMinutos: row.estimacion_minutos,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const getSubtareas = async (req, res, next) => {
  try {
    const role = resolveRole(req);
    if (!['USER', 'ADMIN', 'GOD'].includes(role)) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    const tareaId = req.query.tareaId ? Number(req.query.tareaId) : null;
    const isDashboard = req.query.dashboard === '1';
    if (tareaId !== null && !isNumericId(tareaId)) {
      return fail(res, 'Tarea inválida', null, 400);
    }
    const params = [];
    const where = ['s.deleted_at IS NULL', 't.deleted_at IS NULL', 'p.deleted_at IS NULL'];
    if (tareaId !== null) {
      params.push(tareaId);
      where.push(`s.tarea_id = $${params.length}`);
    }
    if (role === 'USER') {
      const userParam = `$${params.length + 1}`;
      where.push(`(t.usuario_asignado_id = ${userParam} OR (t.usuario_asignado_id IS NULL AND p.usuario_asignado_id = ${userParam}))`);
      params.push(req.user.id);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const query = `
      SELECT s.*,
        p.created_by AS proyecto_created_by
      FROM subtareas s
      JOIN tareas t ON t.id = s.tarea_id
      JOIN proyectos p ON p.id = t.proyecto_id
      ${whereClause}
      ORDER BY s.created_at DESC
    `;
    const result = await db.query(query, params);
    if (isDashboard) {
      console.info('dashboard:subtareas', {
        userId: req.user.id,
        rol: req.user.rol,
        tareaId: tareaId ?? undefined,
        count: result.rows.length
      });
    }
    return success(res, 'Subtareas obtenidas', result.rows.map(mapSubtareaRow));
  } catch (error) {
    next(error);
  }
};

const createSubtarea = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const role = resolveRole(req);
    if (!['ADMIN', 'GOD'].includes(role)) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    const {
      tareaId,
      nombre,
      descripcion,
      prioridad = 'media',
      estado = 'por_hacer',
      fechaInicio,
      fechaFin,
      estimacionMinutos
    } = req.body;
    const estimatedMinutes = estimacionMinutos !== undefined
      ? estimacionMinutos
      : calculateEstimatedMinutes(fechaInicio, fechaFin);

    const errors = [];
    if (!isNumericId(tareaId)) errors.push('Tarea inválida');
    if (!isRequired(nombre) || !minLength(nombre, 3)) errors.push('Nombre inválido');
    if (!isValidPrioridad(prioridad)) errors.push('Prioridad inválida');
    if (!isValidEstado(estado)) errors.push('Estado inválido');
    if (fechaInicio && fechaFin && new Date(fechaFin) <= new Date(fechaInicio)) {
      errors.push('Rango de fechas inválido');
    }
    if (errors.length > 0) {
      return fail(res, 'Error de validación', errors, 400);
    }

    const taskResult = await client.query(
      `SELECT t.id, t.proyecto_id
       FROM tareas t
       JOIN proyectos p ON p.id = t.proyecto_id
       WHERE t.id = $1 AND t.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [tareaId]
    );
    if (taskResult.rows.length === 0) {
      return fail(res, 'Tarea no encontrada', null, 404);
    }

    await client.query('BEGIN');
    const insertQuery = `
      INSERT INTO subtareas
        (tarea_id, nombre, descripcion, prioridad, estado, fecha_inicio, fecha_fin, estimacion_minutos, created_by)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    const insertResult = await client.query(insertQuery, [
      tareaId,
      nombre,
      descripcion || null,
      prioridad,
      estado,
      fechaInicio || null,
      fechaFin || null,
      estimatedMinutes || null,
      req.user.id
    ]);
    const subtareaId = insertResult.rows[0].id;

    await logAudit(client, req.user.id, 'SUBTAREA_CREATE', subtareaId, {
      nombre,
      tareaId,
      prioridad,
      estado
    });
    await client.query('COMMIT');

    const result = await db.query(
      `SELECT s.*
       FROM subtareas s
       JOIN tareas t ON t.id = s.tarea_id
       JOIN proyectos p ON p.id = t.proyecto_id
       WHERE s.id = $1 AND s.deleted_at IS NULL AND t.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [subtareaId]
    );
    return success(res, 'Subtarea creada', mapSubtareaRow(result.rows[0]), 201);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

const getSubtareasByTarea = async (req, res, next) => {
  req.query = { ...(req.query || {}), tareaId: req.params.id };
  return getSubtareas(req, res, next);
};

const createSubtareaForTarea = async (req, res, next) => {
  req.body = { ...(req.body || {}), tareaId: req.params.id };
  return createSubtarea(req, res, next);
};

const updateSubtarea = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const requestedId = req.params.id;
    const role = resolveRole(req);
    if (!['USER', 'ADMIN', 'GOD'].includes(role)) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    const id = Number(requestedId);
    console.info('SubtareasController:updateSubtarea:start', {
      requestedId,
      parsedId: id,
      role,
      userId: req.user?.id ?? null,
      body: req.body
    });
    if (!isNumericId(id)) {
      return fail(res, 'ID inválido', null, 400);
    }
    const currentResult = await client.query(
      `SELECT s.*, t.usuario_asignado_id, p.usuario_asignado_id AS proyecto_usuario_asignado_id, p.created_by AS proyecto_created_by
       FROM subtareas s
       JOIN tareas t ON t.id = s.tarea_id
       JOIN proyectos p ON p.id = t.proyecto_id
       WHERE s.id = $1 AND s.deleted_at IS NULL AND t.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [id]
    );
    if (currentResult.rows.length === 0) {
      const diagnosticsResult = await client.query(
        `SELECT s.id,
                s.deleted_at AS subtarea_deleted_at,
                t.id AS tarea_id,
                t.deleted_at AS tarea_deleted_at,
                p.id AS proyecto_id,
                p.deleted_at AS proyecto_deleted_at
         FROM subtareas s
         LEFT JOIN tareas t ON t.id = s.tarea_id
         LEFT JOIN proyectos p ON p.id = t.proyecto_id
         WHERE s.id = $1`,
        [id]
      );
      const diagnostics = diagnosticsResult.rows[0] || null;
      console.warn('SubtareasController:updateSubtarea:not-found', {
        subtaskId: id,
        userId: req.user?.id ?? null,
        role,
        diagnostics
      });
      if (!diagnostics) {
        return fail(res, `Subtarea no encontrada para ID ${id}`, null, 404);
      }
      if (diagnostics.subtarea_deleted_at) {
        return fail(res, `Subtarea ${id} está eliminada`, null, 404);
      }
      if (diagnostics.tarea_deleted_at) {
        return fail(res, `La tarea asociada a la subtarea ${id} está eliminada`, null, 404);
      }
      if (diagnostics.proyecto_deleted_at) {
        return fail(res, `El proyecto asociado a la subtarea ${id} está eliminado`, null, 404);
      }
      return fail(res, `Subtarea no disponible para edición (ID ${id})`, null, 404);
    }
    const current = currentResult.rows[0];
    const {
      tareaId,
      nombre,
      descripcion,
      prioridad,
      estado,
      fechaInicio,
      fechaFin,
      estimacionMinutos
    } = req.body;
    const effectiveAssignedUserId = current.usuario_asignado_id ?? current.proyecto_usuario_asignado_id;
    if (role === 'USER') {
      if (effectiveAssignedUserId !== req.user.id) {
        return fail(res, 'Acceso denegado', null, 403);
      }
      const hasNonStateChanges = [
        tareaId,
        nombre,
        descripcion,
        prioridad,
        fechaInicio,
        fechaFin,
        estimacionMinutos
      ].some((value) => value !== undefined);
      if (hasNonStateChanges) {
        return fail(res, 'Acceso denegado', null, 403);
      }
      if (estado === undefined) {
        return fail(res, 'Estado requerido', null, 400);
      }
    }

    const errors = [];
    if (tareaId !== undefined && tareaId !== current.tarea_id) errors.push('No se puede cambiar la tarea de una subtarea');
    if (nombre !== undefined && (!isRequired(nombre) || !minLength(nombre, 3))) errors.push('Nombre inválido');
    if (prioridad !== undefined && !isValidPrioridad(prioridad)) errors.push('Prioridad inválida');
    if (estado !== undefined && !isValidEstado(estado)) errors.push('Estado inválido');
    const fechaInicioFinal = fechaInicio !== undefined ? fechaInicio : current.fecha_inicio;
    const fechaFinFinal = fechaFin !== undefined ? fechaFin : current.fecha_fin;
    if (fechaInicioFinal && fechaFinFinal && new Date(fechaFinFinal) <= new Date(fechaInicioFinal)) {
      errors.push('Rango de fechas inválido');
    }
    const estimatedMinutes = estimacionMinutos !== undefined
      ? estimacionMinutos
      : (fechaInicio !== undefined || fechaFin !== undefined)
        ? calculateEstimatedMinutes(fechaInicioFinal, fechaFinFinal)
        : current.estimacion_minutos;
    if (estimatedMinutes !== null && estimatedMinutes !== undefined) {
      if (!Number.isInteger(Number(estimatedMinutes)) || Number(estimatedMinutes) < 0) {
        errors.push('Estimación inválida');
      }
    }
    if (errors.length > 0) {
      return fail(res, 'Error de validación', errors, 400);
    }

    const fields = [];
    const params = [];
    let idx = 1;
    if (nombre !== undefined) {
      fields.push(`nombre = $${idx++}`);
      params.push(nombre);
    }
    if (descripcion !== undefined) {
      fields.push(`descripcion = $${idx++}`);
      params.push(descripcion || null);
    }
    if (prioridad !== undefined) {
      fields.push(`prioridad = $${idx++}`);
      params.push(prioridad);
    }
    if (estado !== undefined) {
      fields.push(`estado = $${idx++}`);
      params.push(estado);
    }
    if (fechaInicio !== undefined) {
      fields.push(`fecha_inicio = $${idx++}`);
      params.push(fechaInicio || null);
    }
    if (fechaFin !== undefined) {
      fields.push(`fecha_fin = $${idx++}`);
      params.push(fechaFin || null);
    }
    if (estimacionMinutos !== undefined || fechaInicio !== undefined || fechaFin !== undefined) {
      fields.push(`estimacion_minutos = $${idx++}`);
      params.push(estimatedMinutes ?? null);
    }

    if (fields.length === 0) {
      const result = await db.query(
        `SELECT s.*
         FROM subtareas s
         JOIN tareas t ON t.id = s.tarea_id
         JOIN proyectos p ON p.id = t.proyecto_id
         WHERE s.id = $1 AND s.deleted_at IS NULL AND t.deleted_at IS NULL AND p.deleted_at IS NULL`,
        [id]
      );
      return success(res, 'Subtarea sin cambios', mapSubtareaRow(result.rows[0]));
    }

    fields.push('updated_at = NOW()');
    await client.query('BEGIN');
    params.push(id);
    const updateQuery = `UPDATE subtareas SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id`;
    await client.query(updateQuery, params);

    await logAudit(client, req.user.id, 'SUBTAREA_UPDATE', id, {
      before: current,
      after: { nombre, descripcion, prioridad, estado, fechaInicio, fechaFin, estimacionMinutos: estimatedMinutes, tareaId }
    });
    await client.query('COMMIT');

    const result = await db.query(
      `SELECT s.*
       FROM subtareas s
       JOIN tareas t ON t.id = s.tarea_id
       JOIN proyectos p ON p.id = t.proyecto_id
       WHERE s.id = $1 AND s.deleted_at IS NULL AND t.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [id]
    );
    console.info('SubtareasController:updateSubtarea:success', {
      subtaskId: id,
      userId: req.user?.id ?? null,
      role
    });
    return success(res, 'Subtarea actualizada', mapSubtareaRow(result.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

const getSubtareaDeletePreview = async (req, res, next) => {
  try {
    const role = resolveRole(req);
    if (!['ADMIN', 'GOD'].includes(role)) {
      return fail(res, 'Acceso denegado', null, 403);
    }
    const id = Number(req.params.id);
    if (!isNumericId(id)) {
      return fail(res, 'ID inválido', null, 400);
    }
    const subtaskResult = await db.query(
      `SELECT s.*, t.usuario_asignado_id, p.usuario_asignado_id AS proyecto_usuario_asignado_id, p.created_by AS proyecto_created_by
       FROM subtareas s
       JOIN tareas t ON t.id = s.tarea_id
       JOIN proyectos p ON p.id = t.proyecto_id
       WHERE s.id = $1 AND s.deleted_at IS NULL AND t.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [id]
    );
    if (subtaskResult.rows.length === 0) {
      return fail(res, 'Subtarea no encontrada', null, 404);
    }
    const notesResult = await db.query(
      'SELECT COUNT(*)::int AS total FROM notas WHERE scope = $1 AND referencia_id = $2 AND deleted_at IS NULL',
      ['subtarea', id]
    );
    return success(res, 'Resumen de eliminación', {
      subtask: mapSubtareaRow(subtaskResult.rows[0]),
      notes: notesResult.rows[0].total
    });
  } catch (error) {
    next(error);
  }
};

const deleteSubtarea = async (req, res, next) => {
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
      `SELECT s.*, t.usuario_asignado_id, p.usuario_asignado_id AS proyecto_usuario_asignado_id, p.created_by AS proyecto_created_by
       FROM subtareas s
       JOIN tareas t ON t.id = s.tarea_id
       JOIN proyectos p ON p.id = t.proyecto_id
       WHERE s.id = $1 AND s.deleted_at IS NULL AND t.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [id]
    );
    if (currentResult.rows.length === 0) {
      return fail(res, 'Subtarea no encontrada', null, 404);
    }
    await client.query('BEGIN');
    const deletedAt = new Date();
    await client.query('UPDATE subtareas SET deleted_at = $1 WHERE id = $2', [deletedAt, id]);
    const notesResult = await client.query(
      'UPDATE notas SET deleted_at = $1 WHERE scope = $2 AND referencia_id = $3 AND deleted_at IS NULL RETURNING id',
      [deletedAt, 'subtarea', id]
    );
    await logAudit(client, req.user.id, 'SUBTAREA_CASCADE_DELETE', id, {
      reason,
      deletedAt,
      notesDeleted: notesResult.rows.length
    });
    await client.query('COMMIT');
    return success(res, 'Subtarea eliminada', {
      id,
      notesDeleted: notesResult.rows.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

module.exports = {
  getSubtareas,
  createSubtarea,
  getSubtareasByTarea,
  createSubtareaForTarea,
  updateSubtarea,
  getSubtareaDeletePreview,
  deleteSubtarea
};
