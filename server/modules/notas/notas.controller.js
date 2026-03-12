const db = require('../../config/db');
const { success, fail } = require('../../utils/responses');
const { isRequired, minLength, isNumericId } = require('../../utils/validators');

const getNotas = async (req, res, next) => {
  try {
    const scope = req.query.scope ? String(req.query.scope) : null;
    const referenciaId = req.query.referenciaId ? Number(req.query.referenciaId) : null;
    if (referenciaId !== null && !isNumericId(referenciaId)) {
      return fail(res, 'Referencia inválida', null, 400);
    }
    const allowedScopes = ['personal', 'proyecto', 'tarea', 'subtarea'];
    if (scope && !allowedScopes.includes(scope)) {
      return fail(res, 'Ámbito inválido', null, 400);
    }
    const params = [];
    const where = ['deleted_at IS NULL'];
    if (scope) {
      params.push(scope);
      where.push(`scope = $${params.length}`);
    }
    if (referenciaId !== null) {
      params.push(referenciaId);
      where.push(`referencia_id = $${params.length}`);
    }
    if (req.user.rol === 'USER') {
      params.push(req.user.id);
      where.push(`usuario_id = $${params.length}`);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT id, scope, referencia_id, usuario_id, contenido, created_at, updated_at, titulo, tipo
       FROM notas ${whereClause} ORDER BY created_at DESC`,
      params
    );
    const notes = result.rows.map((row) => ({
      id: row.id,
      titulo: row.titulo,
      tipo: row.tipo ?? (row.scope === 'personal' ? 'personal' : 'actividad'),
      actividadId: row.referencia_id ?? null,
      scope: row.scope,
      referenciaId: row.referencia_id,
      userId: row.usuario_id,
      contenido: row.contenido,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? null
    }));
    return success(res, 'Notas obtenidas', notes);
  } catch (error) {
    next(error);
  }
};

const createNota = async (req, res, next) => {
  try {
    const titulo = req.body?.titulo ? String(req.body.titulo).trim() : '';
    const contenido = req.body?.contenido ? String(req.body.contenido).trim() : '';
    const tipo = req.body?.tipo ? String(req.body.tipo).trim() : '';
    const actividadTipo = req.body?.actividadTipo ? String(req.body.actividadTipo).trim() : null;
    const actividadId = req.body?.actividadId ? Number(req.body.actividadId) : null;
    if (!isRequired(titulo) || !minLength(titulo, 3)) {
      return fail(res, 'El título es obligatorio y debe tener al menos 3 caracteres.', null, 400);
    }
    if (!isRequired(contenido) || !minLength(contenido, 3)) {
      return fail(res, 'El contenido es obligatorio y debe tener al menos 3 caracteres.', null, 400);
    }
    const allowedTipos = ['personal', 'actividad'];
    if (!allowedTipos.includes(tipo)) {
      return fail(res, 'El tipo de nota es inválido.', null, 400);
    }
    let scope = 'personal';
    let referenciaId = null;
    if (tipo === 'actividad') {
      const allowedScopes = ['proyecto', 'tarea', 'subtarea'];
      if (!actividadTipo || !allowedScopes.includes(actividadTipo)) {
        return fail(res, 'El tipo de actividad es inválido.', null, 400);
      }
      if (!isNumericId(actividadId)) {
        return fail(res, 'La actividad relacionada es inválida.', null, 400);
      }
      scope = actividadTipo;
      referenciaId = actividadId;
    }
    const query = `
      INSERT INTO notas
        (titulo, contenido, tipo, scope, referencia_id, usuario_id)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      RETURNING id, titulo, contenido, tipo, scope, referencia_id, usuario_id, created_at, updated_at
    `;
    const params = [titulo, contenido, tipo, scope, referenciaId, req.user.id];
    const result = await db.query(query, params);
    const row = result.rows[0];
    return success(res, 'Nota creada', {
      id: row.id,
      titulo: row.titulo,
      tipo: row.tipo,
      actividadId: row.referencia_id,
      scope: row.scope,
      referenciaId: row.referencia_id,
      userId: row.usuario_id,
      contenido: row.contenido,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? null
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotas,
  createNota
};
