const db = require('../../config/db');
const { createProyecto, updateProyecto, getProyectos, getProyectoById } = require('../../modules/proyectos/proyectos.controller');

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

describe('Proyectos Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.pool.connect.mockResolvedValue({
      query: jest.fn(),
      release: jest.fn()
    });
  });

  test('getProyectos should allow ADMIN without created_by filter', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const req = {
      user: { id: 5, rol: 'ADMIN' },
      query: {}
    };
    const res = createRes();
    await getProyectos(req, res, jest.fn());
    const query = db.query.mock.calls[0][0];
    expect(query).not.toContain('WHERE (created_by');
    expect(query).not.toContain('usuario_asignado_id = $');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('getProyectoById should allow ADMIN even when not created', async () => {
    db.query.mockResolvedValue({
      rows: [{
        id: 12,
        nombre: 'Proyecto X',
        descripcion: null,
        prioridad: 'media',
        estado: 'por_hacer',
        fecha_inicio: null,
        fecha_fin: null,
        estimacion_minutos: null,
        usuario_asignado_id: 4,
        created_by: 4,
        usuario_asignado_nombre: 'Usuario',
        created_at: new Date(),
        updated_at: new Date()
      }]
    });
    const req = {
      user: { id: 8, rol: 'ADMIN' },
      params: { id: 12 }
    };
    const res = createRes();
    await getProyectoById(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('createProyecto should allow ADMIN role', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    client.query
      .mockResolvedValueOnce({ rows: [{ rol: 'ADMIN' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 11 }] })
      .mockResolvedValueOnce({});
    db.pool.connect.mockResolvedValue(client);
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 11,
          nombre: 'Proyecto Admin',
          descripcion: null,
          prioridad: 'media',
          estado: 'por_hacer',
          fecha_inicio: null,
          fecha_fin: null,
          estimacion_minutos: null,
          usuario_asignado_id: 3,
          usuario_asignado_nombre: 'Admin',
          created_at: new Date(),
          updated_at: new Date()
        }
      ]
    });

    const req = {
      user: { id: 3, rol: 'ADMIN' },
      body: {
        nombre: 'Proyecto Admin',
        prioridad: 'media',
        estado: 'por_hacer',
        usuarioAsignadoId: 3
      }
    };
    const res = createRes();
    await createProyecto(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('createProyecto should deny USER role', async () => {
    const req = {
      user: { id: 1, rol: 'USER' },
      body: { prioridad: 'media', estado: 'por_hacer' }
    };
    const res = createRes();
    await createProyecto(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('createProyecto should deny USER payload', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })
      .mockResolvedValueOnce({});
    db.pool.connect.mockResolvedValue(client);
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          nombre: 'Proyecto A',
          descripcion: null,
          prioridad: 'media',
          estado: 'por_hacer',
          fecha_inicio: null,
          fecha_fin: null,
          estimacion_minutos: null,
          usuario_asignado_id: 2,
          usuario_asignado_nombre: 'Usuario',
          created_at: new Date(),
          updated_at: new Date()
        }
      ]
    });

    const req = {
      user: { id: 2, rol: 'USER' },
      body: {
        nombre: 'Proyecto A',
        prioridad: 'media',
        estado: 'por_hacer',
        usuarioAsignadoId: 2
      }
    };
    const res = createRes();
    await createProyecto(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('createProyecto should deny USER date range request', async () => {
    const req = {
      user: { id: 2, rol: 'USER' },
      body: {
        nombre: 'Proyecto B',
        prioridad: 'media',
        estado: 'por_hacer',
        usuarioAsignadoId: 2,
        fechaInicio: '2026-03-10',
        fechaFin: '2026-03-01'
      }
    };
    const res = createRes();
    await createProyecto(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('updateProyecto should allow ADMIN role when created', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 1, usuario_asignado_id: 2, created_by: 2, estado: 'por_hacer' }] }),
      release: jest.fn()
    };
    client.query.mockResolvedValueOnce({ rows: [{ id: 1, usuario_asignado_id: 2, created_by: 2, estado: 'por_hacer' }] });
    db.pool.connect.mockResolvedValue(client);
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 1,
        nombre: 'Proyecto X',
        descripcion: null,
        prioridad: 'media',
        estado: 'por_hacer',
        fecha_inicio: null,
        fecha_fin: null,
        estimacion_minutos: null,
        usuario_asignado_id: 2,
        created_by: 2,
        usuario_asignado_nombre: 'Admin',
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
    await updateProyecto(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(client.release).toHaveBeenCalled();
  });
});
