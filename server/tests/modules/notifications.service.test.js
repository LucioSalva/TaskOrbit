const db = require('../../config/db');
const { registerClient, removeClient, createNotification } = require('../../modules/notificaciones/notifications.service');

jest.mock('../../config/db', () => ({
  query: jest.fn()
}));

describe('Notifications Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createNotification should write to SSE clients for in_app channel', async () => {
    const res = {
      write: jest.fn()
    };
    registerClient(5, res);
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          user_id: 5,
          type: 'asignacion_tarea',
          title: 'Nueva tarea',
          message: 'Asignación',
          severity: 'info',
          channel: 'in_app',
          entity_type: 'tarea',
          entity_id: 10,
          read: false,
          status: 'sent',
          created_at: new Date(),
          delivered_at: new Date()
        }
      ]
    });

    await createNotification({
      userId: 5,
      type: 'asignacion_tarea',
      title: 'Nueva tarea',
      message: 'Asignación',
      channel: 'in_app',
      entityType: 'tarea',
      entityId: 10
    });

    expect(db.query).toHaveBeenCalled();
    expect(res.write).toHaveBeenCalled();
    removeClient(5, res);
  });
});
