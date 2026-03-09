const request = require('supertest');
const express = require('express');

jest.mock('../../config/db', () => ({
  query: jest.fn()
}));

jest.mock('../../middlewares/auth.middleware', () => (req, res, next) => {
  req.user = { id: 1, rol: 'ADMIN' };
  next();
});

const db = require('../../config/db');
const notasRoutes = require('../../modules/notas/notas.routes');

const app = express();
app.use(express.json());
app.use('/api/notas', notasRoutes);

describe('Integration: Notas API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [] });
  });

  test('should return 200 with empty data list', async () => {
    const res = await request(app).get('/api/notas');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('should validate referenciaId', async () => {
    const res = await request(app).get('/api/notas?referenciaId=invalid');
    expect(res.status).toBe(400);
  });

  test('should create personal note', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          titulo: 'Nota personal',
          contenido: 'Contenido',
          tipo: 'personal',
          actividad_id: null,
          scope: 'personal',
          referencia_id: null,
          usuario_id: 1,
          user_id: 1,
          fecha_creacion: new Date(),
          fecha_actualizacion: new Date(),
          created_at: new Date()
        }
      ]
    });

    const res = await request(app)
      .post('/api/notas')
      .send({ titulo: 'Nota personal', contenido: 'Contenido', tipo: 'personal' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.titulo).toBe('Nota personal');
    expect(db.query).toHaveBeenCalled();
  });

  test('should create activity note', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 11,
          titulo: 'Nota tarea',
          contenido: 'Contenido',
          tipo: 'actividad',
          actividad_id: 5,
          scope: 'tarea',
          referencia_id: 5,
          usuario_id: 1,
          user_id: 1,
          fecha_creacion: new Date(),
          fecha_actualizacion: new Date(),
          created_at: new Date()
        }
      ]
    });

    const res = await request(app)
      .post('/api/notas')
      .send({ titulo: 'Nota tarea', contenido: 'Contenido', tipo: 'actividad', actividadTipo: 'tarea', actividadId: 5 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.actividadId).toBe(5);
    expect(db.query).toHaveBeenCalled();
  });

  test('should validate activity payload', async () => {
    const res = await request(app)
      .post('/api/notas')
      .send({ titulo: 'Nota', contenido: 'Contenido', tipo: 'actividad' });
    expect(res.status).toBe(400);
  });
});
