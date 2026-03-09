import { Injectable, computed, signal } from '@angular/core';
import { NotificationItem, NotificationSource } from '../interfaces/notification.interface';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly storageKey = 'taskorbit.notifications';
  notifications = signal<NotificationItem[]>(this.read());

  unreadCount = computed(() => this.notifications().filter((item) => !item.read).length);
  recentToasts = computed(() =>
    this.notifications()
      .filter((item) => !item.read)
      .slice(0, 3)
  );

  // TODO: Sincronizar estas operaciones con la API real de notificaciones cuando esté disponible.
  add(notification: NotificationItem): void {
    this.notifications.update((items) => [notification, ...items].slice(0, 200));
    this.persist();
  }

  addMany(items: NotificationItem[]): void {
    if (items.length === 0) {
      return;
    }
    this.notifications.update((state) => [...items, ...state].slice(0, 200));
    this.persist();
  }

  markRead(id: string): void {
    this.notifications.update((items) =>
      items.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
    this.persist();
  }

  markAllRead(): void {
    this.notifications.update((items) => items.map((item) => ({ ...item, read: true })));
    this.persist();
  }

  removeBySource(source: NotificationSource): void {
    this.notifications.update((items) => items.filter((item) => item.source !== source));
    this.persist();
  }

  clear(): void {
    this.notifications.set([]);
    this.persist();
  }

  private read(): NotificationItem[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }
    try {
      const data = JSON.parse(raw) as NotificationItem[];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.notifications()));
  }
}
