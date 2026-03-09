const db = require('../../config/db');
const { success, fail } = require('../../utils/responses');
const { isRequired, minLength, isNumericId, isValidEstado, isValidPrioridad } = require('../../utils/validators');
const { logAudit } = require('../../utils/audit');

const normalizeRole = (role) => {
  const raw = String(role ?? '').trim().toUpperCase();
  if (!raw) {
    return raw;
  }
  if (raw.includes('GOD')) {
    return 'GOD';
  }
  if (raw.startsWith('ADMIN') || raw.includes('ADMINISTR') || raw === 'ADM') {
    return 'ADMIN';
  }
  if (raw.startsWith('USER') || raw.startsWith('USUARIO') || raw.startsWith('USUAR')) {
    return 'USER';
  }
  return raw;
};

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

const countBusinessDays = (startDate, endDate) => {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

const calculateEstimatedMinutes = (fechaInicio, fechaFin) => {
  if (!fechaInicio || !fechaFin) {
    return null;
  }
  const startDate = new Date(fechaInicio);
  const endDate = new Date(fechaFin);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  if (endDate < startDate) {
    return null;
  }
  const days = countBusinessDays(startDate, endDate);
  if (days <= 0) {
    return null;
  }
  return days * 8 * 60;
};

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
  getSubtareaDeletePreview,
  deleteSubtarea
};
