import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, computed, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ProyectosListadoComponent } from './proyectos-listado.component';
import { AuthService } from '../../../auth/services/auth.service';
import { ProyectosService } from '../../services/proyectos.service';
import { AdminUsuariosService } from '../../../admin-usuarios/services/admin-usuarios.service';
import { EstadoChangeTrackerService } from '../../services/estado-change-tracker.service';
import { TareasService } from '../../services/tareas.service';
import { SubtareasService } from '../../services/subtareas.service';

class MockAuthService {
  private userSignal = signal({
    id: 1,
    username: 'user',
    nombre_completo: 'Usuario',
    rol: 'ADMIN'
  });
  currentUser = computed(() => this.userSignal());
  userRole = computed(() => this.userSignal()?.rol);
  logout = jasmine.createSpy('logout');
}

class MockProyectosService {
  getProyectos() {
    return of([]);
  }
  createProyecto() {
    return of(null);
  }
  updateProyecto() {
    return of(null);
  }
}

class MockAdminUsuariosService {
  getUsuarios() {
    return of([]);
  }
}

class MockTareasService {
  getTareasByProyecto() {
    return of([]);
  }
}

class MockSubtareasService {
  getSubtareasByTarea() {
    return of([]);
  }
}

class MockEstadoChangeTrackerService {
  trackChange = jasmine.createSpy('trackChange');
}

describe('ProyectosListadoComponent', () => {
  let fixture: ComponentFixture<ProyectosListadoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProyectosListadoComponent],
      providers: [
        { provide: AuthService, useClass: MockAuthService },
        { provide: ProyectosService, useClass: MockProyectosService },
        { provide: AdminUsuariosService, useClass: MockAdminUsuariosService },
        { provide: EstadoChangeTrackerService, useClass: MockEstadoChangeTrackerService },
        { provide: TareasService, useClass: MockTareasService },
        { provide: SubtareasService, useClass: MockSubtareasService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ProyectosListadoComponent);
    fixture.detectChanges();
  });

  it('renders a single Nuevo proyecto button', () => {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
    const matches = buttons.filter((button) =>
      (button.textContent || '').includes('Nuevo proyecto')
    );
    expect(matches.length).toBe(1);
  });
});
