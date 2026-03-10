import { Injectable, computed, signal } from '@angular/core';
import { NotificationItem, NotificationSource } from '../interfaces/notification.interface';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly storageKey = 'taskorbit.notifications';
  private readonly hiddenAlertsStorageKey = 'taskorbit.hiddenAlerts';
  private readonly minAutoDismissMs = 3000;
  private readonly maxAutoDismissMs = 5000;
  private readonly defaultInfoAutoDismissMs = 4000;
  private readonly autoDismissTimers = new Map<string, ReturnType<typeof setTimeout>>();
  notifications = signal<NotificationItem[]>(this.read());
  hiddenAlerts = signal<string[]>(this.readHiddenAlerts());

  unreadCount = computed(() => this.notifications().filter((item) => !item.read).length);
  recentToasts = computed(() =>
    this.notifications()
      .filter((item) => !item.read)
      .slice(0, 3)
  );

  constructor() {
    this.initializeAutoDismiss();
  }

  add(notification: NotificationItem): void {
    const normalized = this.normalizeNotification(notification);
    if (this.isHiddenAlert(normalized.id)) {
      return;
    }
    this.notifications.update((items) => [normalized, ...items].slice(0, 200));
    this.persist();
    this.scheduleAutoDismiss(normalized);
  }

  addMany(items: NotificationItem[]): void {
    if (items.length === 0) {
      return;
    }
    const normalized = items
      .map((item) => this.normalizeNotification(item))
      .filter((item) => !this.isHiddenAlert(item.id));
    if (normalized.length === 0) {
      return;
    }
    this.notifications.update((state) => [...normalized, ...state].slice(0, 200));
    this.persist();
    normalized.forEach((item) => this.scheduleAutoDismiss(item));
  }

  markRead(id: string): void {
    this.clearAutoDismissTimer(id);
    this.notifications.update((items) =>
      items.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
    this.persist();
  }

  remove(id: string): void {
    this.clearAutoDismissTimer(id);
    this.notifications.update((items) => items.filter((item) => item.id !== id));
    this.persist();
  }

  markAllRead(): void {
    this.notifications().forEach((item) => this.clearAutoDismissTimer(item.id));
    this.notifications.update((items) => items.map((item) => ({ ...item, read: true })));
    this.persist();
  }

  removeBySource(source: NotificationSource): void {
    this.notifications().forEach((item) => {
      if (item.source === source) {
        this.clearAutoDismissTimer(item.id);
      }
    });
    this.notifications.update((items) => items.filter((item) => item.source !== source));
    this.persist();
  }

  clear(): void {
    this.autoDismissTimers.forEach((timer) => clearTimeout(timer));
    this.autoDismissTimers.clear();
    this.notifications.set([]);
    this.persist();
  }

  addHiddenAlert(alertId: string): void {
    this.hiddenAlerts.update((ids) => {
      if (ids.includes(alertId)) {
        return ids;
      }
      return [...ids, alertId];
    });
    this.persistHiddenAlerts();
  }

  removeHiddenAlert(alertId: string): void {
    this.hiddenAlerts.update((ids) => ids.filter((id) => id !== alertId));
    this.persistHiddenAlerts();
  }

  clearHiddenAlerts(): void {
    this.hiddenAlerts.set([]);
    this.persistHiddenAlerts();
  }

  isHiddenAlert(alertId: string): boolean {
    return this.hiddenAlerts().includes(alertId);
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

  private readHiddenAlerts(): string[] {
    const raw = localStorage.getItem(this.hiddenAlertsStorageKey);
    if (!raw) {
      return [];
    }
    try {
      const data = JSON.parse(raw) as string[];
      return Array.isArray(data) ? data.filter((item) => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  private persistHiddenAlerts(): void {
    localStorage.setItem(this.hiddenAlertsStorageKey, JSON.stringify(this.hiddenAlerts()));
  }

  private initializeAutoDismiss(): void {
    const normalized = this.notifications().map((item) => this.normalizeNotification(item));
    this.notifications.set(normalized);
    normalized.forEach((item) => this.scheduleAutoDismiss(item));
    this.persist();
  }

  private normalizeNotification(item: NotificationItem): NotificationItem {
    const persistent = item.persistent ?? item.severity === 'danger';
    if (persistent) {
      return {
        ...item,
        persistent: true,
        autoDismissMs: null
      };
    }

    const requestedMs = item.autoDismissMs ?? this.defaultInfoAutoDismissMs;
    const autoDismissMs = Math.min(Math.max(requestedMs, this.minAutoDismissMs), this.maxAutoDismissMs);
    return {
      ...item,
      persistent: false,
      autoDismissMs
    };
  }

  private scheduleAutoDismiss(item: NotificationItem): void {
    if (item.read || item.persistent || !item.autoDismissMs) {
      return;
    }
    this.clearAutoDismissTimer(item.id);
    const timer = window.setTimeout(() => {
      this.markRead(item.id);
    }, item.autoDismissMs);
    this.autoDismissTimers.set(item.id, timer);
  }

  private clearAutoDismissTimer(id: string): void {
    const timer = this.autoDismissTimers.get(id);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    this.autoDismissTimers.delete(id);
  }
}
