export type NotificationType =
  | 'asignacion_proyecto'
  | 'asignacion_tarea'
  | 'asignacion_subtarea'
  | 'por_vencer'
  | 'vencido';

export type NotificationSeverity = 'info' | 'warning' | 'danger';
export type NotificationSource = 'mock' | 'local' | 'api';
export type NotificationChannel = 'in_app' | 'whatsapp';

export interface NotificationEntityRef {
  tipo: 'proyecto' | 'tarea' | 'subtarea';
  id: number;
  nombre?: string;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  severity: NotificationSeverity;
  source: NotificationSource;
  channel: NotificationChannel;
  entity?: NotificationEntityRef;
}
