const request = require('supertest');
const express = require('express');
const roleMiddleware = require('../../middlewares/role.middleware');

// Mock logAudit
jest.mock('../../utils/audit', () => ({
  logAudit: jest.fn()
}));

const app = express();
app.use(express.json());

// Mock Auth Middleware
const mockAuth = (role) => (req, res, next) => {
  req.user = { id: 1, rol: role };
  next();
};

app.get('/admin/users', mockAuth('GOD'), roleMiddleware('GOD', 'ADMIN'), (req, res) => {
  res.status(200).json({ message: 'Success' });
});

app.get('/admin/users/admin', mockAuth('ADMIN'), roleMiddleware('GOD', 'ADMIN'), (req, res) => {
  res.status(200).json({ message: 'Success' });
});

app.get('/admin/users/restricted', mockAuth('USER'), roleMiddleware('GOD', 'ADMIN'), (req, res) => {
  res.status(200).json({ message: 'Success' });
});

describe('Integration: Role Access Control', () => {
  test('should allow GOD user to access protected route', async () => {
    const res = await request(app).get('/admin/users');
    expect(res.status).toBe(200);
  });

  test('should allow ADMIN user to access protected route', async () => {
    const res = await request(app).get('/admin/users/admin');
    expect(res.status).toBe(200);
  });

  test('should deny USER access to GOD route and return 403', async () => {
    const res = await request(app).get('/admin/users/restricted');
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Acceso Denegado');
  });
});
