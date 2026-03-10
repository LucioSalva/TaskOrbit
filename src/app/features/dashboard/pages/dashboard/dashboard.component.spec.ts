import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../../auth/services/auth.service';
import { DashboardMetricsService } from '../../services/dashboard-metrics.service';
import { NotificationService } from '../../../notifications/services/notification.service';
import { DashboardMetrics } from '../../interfaces/dashboard-metrics.interface';
import { NotificationItem } from '../../../notifications/interfaces/notification.interface';

const now = Date.now();
const oneDay = 24 * 60 * 60 * 1000;
const toIso = (deltaMs: number) => new Date(now + deltaMs).toISOString();

class MockAuthService {
  private readonly user = signal({ id: 12, username: 'user', nombre_completo: 'Usuario Demo', rol: 'USER' as const });
  currentUser = computed(() => this.user());
  userRole = computed(() => this.user().rol);
  logout = jasmine.createSpy('logout');
}

class MockDashboardMetricsService {
  getMetrics() {
    return of(buildMetrics());
  }
}

class MockNotificationService {
  notifications = signal<NotificationItem[]>([]);
  hiddenAlerts = signal<string[]>([]);
  unreadCount = computed(() => 0);
  recentToasts = computed(() => []);
  removeBySource = jasmine.createSpy('removeBySource');
  addMany = jasmine.createSpy('addMany');
  remove = jasmine.createSpy('remove').and.callFake((id: string) => {
    this.notifications.update((items) => items.filter((item) => item.id !== id));
  });
  markRead = jasmine.createSpy('markRead');
  markAllRead = jasmine.createSpy('markAllRead');
  clear = jasmine.createSpy('clear');
  addHiddenAlert = jasmine.createSpy('addHiddenAlert').and.callFake((id: string) => {
    this.hiddenAlerts.update((items) => items.includes(id) ? items : [...items, id]);
  });
  removeHiddenAlert = jasmine.createSpy('removeHiddenAlert').and.callFake((id: string) => {
    this.hiddenAlerts.update((items) => items.filter((item) => item !== id));
  });
  clearHiddenAlerts = jasmine.createSpy('clearHiddenAlerts').and.callFake(() => {
    this.hiddenAlerts.set([]);
  });
}

const buildMetrics = (): DashboardMetrics => ({
  source: 'api',
  summary: {
    proyectosActivos: 2,
    tareasPendientes: 2,
    subtareasVencidas: 1,
    tareasTerminadas: 0
  },
  productivity: {
    byUser: [],
    byProject: [],
    byTask: []
  },
  raw: {
    projects: [
      {
        id: 1,
        nombre: 'Proyecto expirado',
        createdAt: toIso(-10 * oneDay),
        prioridad: 'alta',
        usuarioAsignadoId: 12,
        estado: 'haciendo',
        fechaFin: toIso(-oneDay)
      },
      {
        id: 2,
        nombre: 'Proyecto activo',
        createdAt: toIso(-4 * oneDay),
        prioridad: 'media',
        usuarioAsignadoId: 12,
        estado: 'haciendo',
        fechaFin: toIso(2 * oneDay)
      }
    ],
    tasks: [
      {
        id: 11,
        proyectoId: 1,
        nombre: 'Tarea expirada',
        createdAt: toIso(-4 * oneDay),
        prioridad: 'alta',
        estado: 'haciendo',
        fechaFin: toIso(-oneDay)
      },
      {
        id: 22,
        proyectoId: 2,
        nombre: 'Tarea activa',
        createdAt: toIso(-2 * oneDay),
        prioridad: 'media',
        estado: 'por_hacer',
        fechaFin: toIso(3 * oneDay)
      }
    ],
    subtasks: [
      {
        id: 111,
        tareaId: 11,
        nombre: 'Subtarea expirada',
        createdAt: toIso(-2 * oneDay),
        estado: 'haciendo',
        fechaFin: toIso(-oneDay)
      },
      {
        id: 222,
        tareaId: 22,
        nombre: 'Subtarea activa',
        createdAt: toIso(-oneDay),
        estado: 'por_hacer',
        fechaFin: toIso(oneDay)
      }
    ]
  },
  alerts: [
    { id: 1, tipo: 'proyecto', titulo: 'Alerta proyecto', estado: 'haciendo', projectId: 1, vencido: true, diasRestantes: -1 },
    { id: 2, tipo: 'tarea', titulo: 'Alerta tarea', estado: 'haciendo', projectId: 11, vencido: true, diasRestantes: -1 },
    { id: 3, tipo: 'subtarea', titulo: 'Alerta subtarea', estado: 'haciendo', projectId: 111, vencido: true, diasRestantes: -1 },
    { id: 4, tipo: 'proyecto', titulo: 'Alerta vigente', estado: 'por_hacer', projectId: 2, vencido: false, diasRestantes: 2 }
  ],
  users: [{ id: 12, nombre: 'Usuario Demo' }],
  projects: [{ id: 1, nombre: 'Proyecto expirado' }, { id: 2, nombre: 'Proyecto activo' }],
  updatedAt: new Date().toISOString()
});

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let notificationService: MockNotificationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: AuthService, useClass: MockAuthService },
        { provide: DashboardMetricsService, useClass: MockDashboardMetricsService },
        { provide: NotificationService, useClass: MockNotificationService },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    notificationService = TestBed.inject(NotificationService) as unknown as MockNotificationService;
    fixture.detectChanges();
  });

  it('filtra alertas obsoletas y mantiene alertas activas', () => {
    const ids = component.filteredAlerts().map((alert) => alert.id);
    expect(ids).toEqual([4]);
  });

  it('oculta alertas operativas al usar no volver a mostrar', () => {
    const activeAlert = component.filteredAlerts()[0];
    component.hideOperationalAlert(activeAlert);
    fixture.detectChanges();

    expect(notificationService.addHiddenAlert).toHaveBeenCalledWith('dashboard-alert-proyecto-4');
    expect(component.filteredAlerts().length).toBe(0);
  });

  it('el botón cerrar elimina la notificación del DOM', () => {
    notificationService.notifications.set([
      {
        id: 'n-ui-1',
        type: 'asignacion_tarea',
        title: 'Tarea asignada',
        message: 'Mensaje',
        createdAt: new Date().toISOString(),
        read: false,
        severity: 'success',
        autoDismissMs: 4000,
        source: 'api',
        channel: 'in_app'
      }
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.notification-center-card').length).toBe(1);

    const buttons = fixture.nativeElement.querySelectorAll('.notification-center-card button') as NodeListOf<HTMLButtonElement>;
    const closeButton = Array.from(buttons).find((button) => (button.textContent ?? '').trim() === 'Cerrar') as HTMLButtonElement;

    closeButton.click();
    fixture.detectChanges();

    expect(notificationService.remove).toHaveBeenCalledWith('n-ui-1');
    expect(fixture.nativeElement.querySelectorAll('.notification-center-card').length).toBe(0);
  });
});
