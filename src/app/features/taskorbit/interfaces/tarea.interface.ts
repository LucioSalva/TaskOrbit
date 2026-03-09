import { EstadoTarea } from './estado.type';

export type PrioridadTarea = 'baja' | 'media' | 'alta' | 'critica';

export interface Tarea {
  id: number;
  proyectoId: number;
  nombre: string;
  descripcion?: string | null;
  createdAt: string;
  updatedAt?: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  prioridad: PrioridadTarea;
  estimacionMinutos?: number | null;
  usuarioAsignadoId?: number | null;
  usuarioAsignadoNombre?: string | null;
  createdBy?: number | null;
  estado: EstadoTarea;
}
