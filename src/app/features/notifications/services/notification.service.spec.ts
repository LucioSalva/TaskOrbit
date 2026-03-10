import { fakeAsync, tick } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { NotificationItem } from '../interfaces/notification.interface';

const buildNotification = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: 'n-1',
  type: 'asignacion_tarea',
  title: 'Título',
  message: 'Mensaje',
  createdAt: new Date().toISOString(),
  read: false,
  severity: 'info',
  autoDismissMs: 4000,
  source: 'api',
  channel: 'in_app',
  ...overrides
});

describe('NotificationService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persiste alertas ocultas entre sesiones', () => {
    const service = new NotificationService();
    service.addHiddenAlert('alert-1');
    service.addHiddenAlert('alert-2');

    const restored = new NotificationService();

    expect(restored.hiddenAlerts()).toEqual(['alert-1', 'alert-2']);
    expect(restored.isHiddenAlert('alert-1')).toBeTrue();
  });

  it('elimina y restablece alertas ocultas', () => {
    const service = new NotificationService();
    service.addHiddenAlert('alert-1');
    service.addHiddenAlert('alert-2');
    service.removeHiddenAlert('alert-1');

    expect(service.hiddenAlerts()).toEqual(['alert-2']);

    service.clearHiddenAlerts();
    expect(service.hiddenAlerts()).toEqual([]);
  });

  it('el botón cerrar elimina completamente la notificación del estado', () => {
    const service = new NotificationService();
    service.add(buildNotification({ id: 'n-remove' }));
    expect(service.notifications().some((item) => item.id === 'n-remove')).toBeTrue();

    service.remove('n-remove');

    expect(service.notifications().some((item) => item.id === 'n-remove')).toBeFalse();
  });

  it('evita reaparición de elementos marcados como no volver a mostrar', () => {
    const service = new NotificationService();
    service.addHiddenAlert('n-hidden');

    const restored = new NotificationService();
    restored.add(buildNotification({ id: 'n-hidden' }));

    expect(restored.notifications().some((item) => item.id === 'n-hidden')).toBeFalse();
  });

  it('normaliza temporización y auto-cierra notificaciones informativas', fakeAsync(() => {
    const service = new NotificationService();
    service.add(buildNotification({ id: 'n-auto', autoDismissMs: 1000, severity: 'info' }));

    expect(service.notifications()[0].autoDismissMs).toBe(3000);
    expect(service.notifications()[0].read).toBeFalse();

    tick(3000);

    expect(service.notifications()[0].read).toBeTrue();
  }));

  it('mantiene persistentes las notificaciones de error sin cierre automático', fakeAsync(() => {
    const service = new NotificationService();
    service.add(buildNotification({ id: 'n-danger', severity: 'danger', autoDismissMs: 4000 }));

    expect(service.notifications()[0].persistent).toBeTrue();
    expect(service.notifications()[0].autoDismissMs).toBeNull();

    tick(10000);

    expect(service.notifications()[0].read).toBeFalse();
  }));
});
