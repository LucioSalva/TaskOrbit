const db = require('../../config/db');
const { success, fail } = require('../../utils/responses');
const { isNumericId } = require('../../utils/validators');

const normalizeRole = (role) => {
  const raw = String(role ?? '').trim().toUpperCase();
  if (!raw) return raw;
  if (raw.includes('GOD')) return 'GOD';
  if (raw.startsWith('ADMIN') || raw.includes('ADMINISTR') || raw === 'ADM') return 'ADMIN';
  if (raw.startsWith('USER') || raw.startsWith('USUARIO') || raw.startsWith('USUAR')) return 'USER';
  return raw;
};

const resolveRole = (req) => {
  const normalized = normalizeRole(req?.user?.rol);
  if (req?.user) req.user.rol = normalized;
  return normalized;
};

const getMetrics = async (req, res, next) => {
  try {
    const role = resolveRole(req);
    const userId = req.user.id;
    const { status, userId: filterUserId, projectId, dateStart, dateEnd } = req.query;

    console.info('Dashboard:getMetrics:request', {
      requesterId: userId,
      role,
      filters: { status, filterUserId, projectId, dateStart, dateEnd }
    });

    // 1. Base Project Query (For Dropdowns - Role restricted only)
    let baseProjectQuery = `
      SELECT id, nombre, usuario_asignado_id, created_by 
      FROM vw_proyectos p
      WHERE 1=1
    `;
    const baseParams = [];
    let bIdx = 1;

    if (role === 'USER') {
      baseProjectQuery += ` AND p.usuario_asignado_id = $${bIdx++}`;
      baseParams.push(userId);
    } else if (role === 'ADMIN') {
      // User Request: Confirm controller only returns projects where created_by matches admin ID
      baseProjectQuery += ` AND p.created_by = $${bIdx++}`;
      baseParams.push(userId);
    }

    const baseProjectsResult = await db.query(baseProjectQuery, baseParams);
    const allProjects = baseProjectsResult.rows.map(p => ({ id: p.id, nombre: p.nombre }));

    // 2. Filtered Project Query (For Metrics - Role + Filters)
    let filteredProjectQuery = `
      SELECT 
        p.id, p.nombre, p.descripcion, p.prioridad, p.estado, 
        p.fecha_inicio, p.fecha_fin, p.estimacion_minutos, 
        p.usuario_asignado_id, p.created_by, 
        u.nombre_completo as usuario_asignado_nombre,
        p.created_at, p.updated_at
      FROM vw_proyectos p
      LEFT JOIN usuarios u ON p.usuario_asignado_id = u.id
      WHERE 1=1
    `;
    const filteredParams = [];
    let fIdx = 1;

    // Role restrictions (Repeat)
    if (role === 'USER') {
      filteredProjectQuery += ` AND p.usuario_asignado_id = $${fIdx++}`;
      filteredParams.push(userId);
    } else if (role === 'ADMIN') {
      // User Request: Confirm controller only returns projects where created_by matches admin ID
      filteredProjectQuery += ` AND p.created_by = $${fIdx++}`;
      filteredParams.push(userId);
    }

    // Apply Filters
    if (status && status !== 'todos') {
      filteredProjectQuery += ` AND p.estado = $${fIdx++}`;
      filteredParams.push(status);
    }
    if (filterUserId && filterUserId !== 'todos' && isNumericId(filterUserId)) {
      filteredProjectQuery += ` AND p.usuario_asignado_id = $${fIdx++}`;
      filteredParams.push(filterUserId);
    }
    if (projectId && projectId !== 'todos' && isNumericId(projectId)) {
      filteredProjectQuery += ` AND p.id = $${fIdx++}`;
      filteredParams.push(projectId);
    }
    if (dateStart) {
      filteredProjectQuery += ` AND p.fecha_inicio >= $${fIdx++}`;
      filteredParams.push(dateStart);
    }
    if (dateEnd) {
      filteredProjectQuery += ` AND p.fecha_fin <= $${fIdx++}`;
      filteredParams.push(dateEnd);
    }

    console.info('Dashboard:getMetrics:query', { 
      query: filteredProjectQuery.replace(/\s+/g, ' ').trim(), 
      params: filteredParams 
    });

    const filteredProjectsResult = await db.query(filteredProjectQuery, filteredParams);
    const filteredProjects = filteredProjectsResult.rows;
    console.info('Dashboard:getMetrics:result', { count: filteredProjects.length });
    const projectIds = filteredProjects.map(p => p.id);

    // 3. Tasks Query (Linked to filtered projects)
    let tasks = [];
    let subtasks = [];

    if (projectIds.length > 0) {
      let taskQuery = `
        SELECT 
          t.*, 
          COALESCE(t.usuario_asignado_id, p.usuario_asignado_id) as effective_user_id
        FROM vw_tareas t
        JOIN vw_proyectos p ON t.proyecto_id = p.id
        WHERE t.proyecto_id = ANY($1)
      `;
      const taskParams = [projectIds];
      let tIdx = 2;

      if (status && status !== 'todos') {
        taskQuery += ` AND t.estado = $${tIdx++}`;
        taskParams.push(status);
      }
      if (filterUserId && filterUserId !== 'todos' && isNumericId(filterUserId)) {
        taskQuery += ` AND COALESCE(t.usuario_asignado_id, p.usuario_asignado_id) = $${tIdx++}`;
        taskParams.push(filterUserId);
      }

      const tasksResult = await db.query(taskQuery, taskParams);
      tasks = tasksResult.rows;

      const taskIds = tasks.map(t => t.id);
      if (taskIds.length > 0) {
        const subtaskQuery = `SELECT * FROM vw_subtareas WHERE tarea_id = ANY($1)`;
        const subtasksResult = await db.query(subtaskQuery, [taskIds]);
        subtasks = subtasksResult.rows;
      }
    }

    // 4. Users Query
    let users = [];
    if (role === 'ADMIN' || role === 'GOD') {
      const usersResult = await db.query(`
        SELECT id, COALESCE(nombre_completo, username) as nombre 
        FROM usuarios 
        WHERE activo = true 
        ORDER BY nombre ASC
      `);
      users = usersResult.rows;
    } else {
      const userResult = await db.query(`SELECT id, COALESCE(nombre_completo, username) as nombre FROM usuarios WHERE id = $1`, [userId]);
      users = userResult.rows;
    }

    // 5. Mapping and Response
    const mapProject = (p) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      prioridad: p.prioridad,
      estado: p.estado,
      fechaInicio: p.fecha_inicio,
      fechaFin: p.fecha_fin,
      estimacionMinutos: p.estimacion_minutos,
      usuarioAsignadoId: p.usuario_asignado_id,
      createdBy: p.created_by,
      usuarioAsignadoNombre: p.usuario_asignado_nombre,
      createdAt: p.created_at || new Date(),
      updatedAt: p.updated_at || new Date()
    });

    const mapTask = (t) => ({
      id: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion,
      prioridad: t.prioridad,
      estado: t.estado,
      fechaInicio: t.fecha_inicio,
      fechaFin: t.fecha_fin,
      proyectoId: t.proyecto_id,
      usuarioAsignadoId: t.usuario_asignado_id,
      estimacionMinutos: t.estimacion_minutos
    });

    const mapSubtask = (s) => ({
      id: s.id,
      nombre: s.nombre,
      completada: s.completada,
      estado: s.estado,
      tareaId: s.tarea_id
    });

    const formattedProjects = filteredProjects.map(mapProject);
    const formattedTasks = tasks.map(mapTask);
    const formattedSubtasks = subtasks.map(mapSubtask);

    // Productivity by Task (Needed for frontend table)
    const productivityByTask = formattedTasks.map(task => {
        const taskSubtasks = formattedSubtasks.filter(s => s.tareaId === task.id);
        const total = taskSubtasks.length;
        const done = taskSubtasks.filter(s => s.estado === 'terminada').length;
        const progress = total > 0 ? Math.round((done / total) * 100) : (task.estado === 'terminada' ? 100 : 0);
        
        // Simple overdue check (could be improved)
        const isOverdue = task.fechaFin && new Date(task.fechaFin) < new Date() && task.estado !== 'terminada';
        const vencidas = isOverdue ? taskSubtasks.filter(s => s.estado !== 'terminada').length : 0;

        return {
            taskId: task.id,
            projectId: task.proyectoId,
            userId: task.usuarioAsignadoId,
            nombre: task.nombre,
            estado: task.estado,
            progreso: progress,
            subtareasPendientes: total - done,
            subtareasVencidas: vencidas
        };
    });

    const response = {
      source: 'api',
      summary: {
        proyectosActivos: formattedProjects.filter(p => p.estado !== 'terminada').length,
        tareasPendientes: formattedTasks.filter(t => t.estado !== 'terminada').length,
        subtareasVencidas: productivityByTask.reduce((acc, t) => acc + t.subtareasVencidas, 0),
        tareasTerminadas: formattedTasks.filter(t => t.estado === 'terminada').length
      },
      productivity: {
        byUser: [], 
        byProject: [],
        byTask: productivityByTask
      },
      raw: {
        projects: formattedProjects,
        tasks: formattedTasks,
        subtasks: formattedSubtasks
      },
      alerts: [],
      users: users,
      projects: allProjects, // UNFILTERED list for dropdowns
      updatedAt: new Date().toISOString()
    };

    return success(res, 'Métricas obtenidas', response);

  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMetrics
};
