import { EstadoTarea } from './estado.type';

export interface Subtarea {
  id: number;
  tareaId: number;
  nombre: string;
  descripcion?: string | null;
  prioridad?: 'baja' | 'media' | 'alta' | 'critica';
  createdAt: string;
  updatedAt?: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  estimacionMinutos?: number | null;
  createdBy?: number | null;
  estado: EstadoTarea;
}
