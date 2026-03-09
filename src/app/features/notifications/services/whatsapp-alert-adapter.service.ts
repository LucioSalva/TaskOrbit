import { Injectable } from '@angular/core';
import { NotificationItem } from '../interfaces/notification.interface';

@Injectable({
  providedIn: 'root'
})
export class WhatsAppAlertAdapterService {
  preparePayload(notification: NotificationItem): Record<string, unknown> {
    return {
      title: notification.title,
      message: notification.message,
      severity: notification.severity,
      createdAt: notification.createdAt,
      entity: notification.entity ?? null
    };
  }

  send(notification: NotificationItem): void {
    void notification;
    // TODO: Conectar aquí el backend de mensajería (WhatsApp) cuando esté disponible.
  }
}
