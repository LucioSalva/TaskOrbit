import { EstadoTarea } from './estado.type';

export type PrioridadProyecto = 'baja' | 'media' | 'alta' | 'critica';

export interface Proyecto {
  id: number;
  nombre: string;
  descripcion?: string | null;
  createdAt: string;
  updatedAt?: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  prioridad: PrioridadProyecto;
  estimacionMinutos?: number | null;
  usuarioAsignadoId: number;
  usuarioAsignadoNombre?: string | null;
  createdBy?: number | null;
  estado: EstadoTarea;
}
