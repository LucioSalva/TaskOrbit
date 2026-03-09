const db = require('../../config/db');
const { createTarea, updateTarea, getTareas, getTareaById } = require('../../modules/tareas/tareas.controller');

jest.mock('../../config/db', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn()
  }
}));

jest.mock('../../modules/notificaciones/notifications.service', () => ({
  createNotification: jest.fn()
}));

jest.mock('../../utils/audit', () => ({
  logAudit: jest.fn()
}));

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn()
});

describe('Tareas Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.pool.connect.mockResolvedValue({
      query: jest.fn(),
      release: jest.fn()
    });
  });

  test('createTarea should validate required fields for ADMIN', async () => {
    const req = {
      user: { id: 3, rol: 'ADMIN' },
      body: {}
    };
    const res = createRes();
    await createTarea(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createTarea should deny USER role', async () => {
    const req = {
      user: { id: 1, rol: 'USER' },
      body: { nombre: 'Tarea', prioridad: 'media', estado: 'por_hacer' }
    };
    const res = createRes();
    await createTarea(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('updateTarea should allow ADMIN even when not created', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    client.query
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          usuario_asignado_id: 2,
          proyecto_usuario_asignado_id: 7,
          proyecto_created_by: 9,
          fecha_inicio: null,
          fecha_fin: null,
          estado: 'por_hacer'
        }]
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({});
    db.pool.connect.mockResolvedValue(client);
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 1,
        proyecto_id: 2,
        nombre: 'Tarea actualizada',
        descripcion: null,
        prioridad: 'media',
        estado: 'por_hacer',
        fecha_inicio: null,
        fecha_fin: null,
        estimacion_minutos: null,
        usuario_asignado_id: 2,
        usuario_asignado_nombre: 'User 2',
        created_at: new Date(),
        updated_at: new Date()
      }]
    });

    const req = {
      user: { id: 2, rol: 'ADMIN' },
      params: { id: 1 },
      body: { nombre: 'Nuevo nombre' }
    };
    const res = createRes();
    await updateTarea(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(client.release).toHaveBeenCalled();
  });

  test('getTareas should allow ADMIN without created_by filter', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const req = {
      user: { id: 5, rol: 'ADMIN' },
      query: {}
    };
    const res = createRes();
    await getTareas(req, res, jest.fn());
    const query = db.query.mock.calls[0][0];
    expect(query).not.toContain('p.created_by = $');
    expect(query).not.toContain('p.usuario_asignado_id = $');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('getTareas should allow GOD without assigned user filter', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const req = {
      user: { id: 9, rol: 'GOD' },
      query: {}
    };
    const res = createRes();
    await getTareas(req, res, jest.fn());
    const query = db.query.mock.calls[0][0];
    expect(query).not.toContain('t.usuario_asignado_id = $');
    expect(query).not.toContain('p.usuario_asignado_id = $');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('getTareaById should allow ADMIN even when not created', async () => {
    db.query.mockResolvedValue({
      rows: [{
        id: 1,
        proyecto_id: 2,
        nombre: 'Tarea',
        descripcion: null,
        prioridad: 'media',
        estado: 'por_hacer',
        fecha_inicio: null,
        fecha_fin: null,
        estimacion_minutos: null,
        usuario_asignado_id: 4,
        proyecto_created_by: 6,
        usuario_asignado_nombre: 'User 4',
        created_at: new Date(),
        updated_at: new Date()
      }]
    });
    const req = {
      user: { id: 8, rol: 'ADMIN' },
      params: { id: 1 }
    };
    const res = createRes();
    await getTareaById(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('getTareaById should allow GOD even when not assigned', async () => {
    db.query.mockResolvedValue({
      rows: [{
        id: 1,
        proyecto_id: 2,
        nombre: 'Tarea',
        descripcion: null,
        prioridad: 'media',
        estado: 'por_hacer',
        fecha_inicio: null,
        fecha_fin: null,
        estimacion_minutos: null,
        usuario_asignado_id: 4,
        usuario_asignado_nombre: 'User 4',
        created_at: new Date(),
        updated_at: new Date()
      }]
    });
    const req = {
      user: { id: 99, rol: 'GOD' },
      params: { id: 1 }
    };
    const res = createRes();
    await getTareaById(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
