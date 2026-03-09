const roleMiddleware = require('../../middlewares/role.middleware');
const { logAudit } = require('../../utils/audit');

// Mock logAudit
jest.mock('../../utils/audit', () => ({
  logAudit: jest.fn()
}));

describe('Role Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: {
        id: 1,
        rol: 'USER'
      },
      ip: '127.0.0.1',
      method: 'GET',
      originalUrl: '/api/admin',
      connection: { remoteAddress: '::1' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('should call next() if user has allowed role', async () => {
    req.user.rol = 'GOD';
    const middleware = roleMiddleware('GOD');
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('should return 401 if user is not authenticated', async () => {
    req.user = null;
    const middleware = roleMiddleware('GOD');
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuario no autenticado' });
  });

  test('should return 403 and log audit if user does not have allowed role', async () => {
    req.user.rol = 'USER';
    const middleware = roleMiddleware('GOD');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Acceso Denegado')
    }));
    expect(logAudit).toHaveBeenCalledWith(
      null, 
      1, 
      'UNAUTHORIZED_ACCESS', 
      null, 
      expect.any(String), 
      expect.objectContaining({
        ip: '127.0.0.1',
        method: 'GET',
        endpoint: '/api/admin',
        attemptedRole: 'USER'
      })
    );
  });
});