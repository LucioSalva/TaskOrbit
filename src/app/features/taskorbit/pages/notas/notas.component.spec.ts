import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NotasComponent } from './notas.component';
import { AuthService } from '../../../auth/services/auth.service';
import { NotasService } from '../../services/notas.service';
import { ProyectosService } from '../../services/proyectos.service';
import { TareasService } from '../../services/tareas.service';
import { SubtareasService } from '../../services/subtareas.service';

class MockAuthService {
  private userSignal = signal({
    id: 1,
    username: 'admin',
    nombre_completo: 'Admin',
    rol: 'ADMIN'
  });
  currentUser = computed(() => this.userSignal());
  userRole = computed(() => this.userSignal()?.rol);
  logout = jasmine.createSpy('logout');
}

class MockNotasService {
  getNotas() {
    return of([]);
  }
  createNota = jasmine.createSpy('createNota').and.returnValue(
    of({
      id: 1,
      titulo: 'Nota',
      tipo: 'personal',
      scope: 'personal',
      referenciaId: null,
      actividadId: null,
      userId: 1,
      contenido: 'Contenido',
      createdAt: new Date().toISOString(),
      updatedAt: null
    })
  );
}

class MockProyectosService {
  getProyectos() {
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

describe('NotasComponent', () => {
  let fixture: ComponentFixture<NotasComponent>;
  let component: NotasComponent;
  let notasService: MockNotasService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotasComponent],
      providers: [
        { provide: AuthService, useClass: MockAuthService },
        { provide: NotasService, useClass: MockNotasService },
        { provide: ProyectosService, useClass: MockProyectosService },
        { provide: TareasService, useClass: MockTareasService },
        { provide: SubtareasService, useClass: MockSubtareasService },
        provideRouter([])
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(NotasComponent);
    component = fixture.componentInstance;
    notasService = TestBed.inject(NotasService) as unknown as MockNotasService;
    fixture.detectChanges();
  });

  it('renders Agregar nota button', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const matches = buttons.filter((button) =>
      (button.textContent || '').includes('Agregar nota')
    );
    expect(matches.length).toBe(1);
  });

  it('submits a personal note', () => {
    component.openNoteModal();
    component.noteForm.setValue({
      titulo: 'Nota',
      contenido: 'Contenido',
      tipo: 'personal',
      actividadTipo: 'proyecto',
      proyectoId: null,
      tareaId: null,
      subtareaId: null
    });
    component.submitNote();
    expect(notasService.createNota).toHaveBeenCalledWith({
      titulo: 'Nota',
      contenido: 'Contenido',
      tipo: 'personal',
      actividadTipo: undefined,
      actividadId: null
    });
  });
});
