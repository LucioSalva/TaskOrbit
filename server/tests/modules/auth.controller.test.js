const db = require('../../config/db');
const bcrypt = require('bcrypt');
const { login } = require('../../modules/auth/auth.controller');
const { signToken } = require('../../utils/jwt');

jest.mock('../../config/db', () => ({
  query: jest.fn()
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn()
}));

jest.mock('../../utils/jwt', () => ({
  signToken: jest.fn(() => 'token')
}));

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn()
});

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('login returns 401 when user is not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const req = { body: { username: 'admin', password: 'pass' } };
    const res = createRes();

    await login(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('login returns 403 when user is inactive', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'admin', password_hash: 'hash', nombre_completo: 'Admin', activo: false, rol: 'ADMIN' }]
    });
    const req = { body: { username: 'admin', password: 'pass' } };
    const res = createRes();

    await login(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test.each(['USER', 'ADMIN', 'GOD'])('login succeeds for %s role', async (rol) => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'test', password_hash: 'hash', nombre_completo: 'Test', activo: true, rol }]
    });
    bcrypt.compare.mockResolvedValueOnce(true);
    signToken.mockReturnValueOnce('token');

    const req = { body: { username: 'test', password: 'pass' } };
    const res = createRes();

    await login(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      data: expect.objectContaining({
        user: expect.objectContaining({ rol })
      })
    }));
  });
});
