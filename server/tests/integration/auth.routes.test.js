const request = require('supertest');
const db = require('../../config/db');
const bcrypt = require('bcrypt');
const { signToken, verifyToken } = require('../../utils/jwt');

jest.mock('../../config/db', () => ({
  query: jest.fn()
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn()
}));

jest.mock('../../utils/jwt', () => ({
  signToken: jest.fn(() => 'token'),
  verifyToken: jest.fn(() => ({ id: 1 }))
}));

const app = require('../../app');

describe('Integration: Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each(['USER', 'ADMIN', 'GOD'])('POST /api/auth/login authenticates %s role', async (rol) => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'test', password_hash: 'hash', nombre_completo: 'Test', activo: true, rol }]
    });
    bcrypt.compare.mockResolvedValueOnce(true);
    signToken.mockReturnValueOnce('token');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'pass' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.user.rol).toBe(rol);
  });

  test.each(['USER', 'ADMIN', 'GOD'])('GET /api/auth/me returns data for %s role', async (rol) => {
    verifyToken.mockReturnValueOnce({ id: 1 });
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, username: 'test', activo: true, rol }]
      })
      .mockResolvedValueOnce({
        rows: [{ id: 1, username: 'test', nombre_completo: 'Test', telefono: '', activo: true, rol }]
      });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.rol).toBe(rol);
  });
});
