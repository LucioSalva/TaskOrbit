export type NotaScope = 'proyecto' | 'tarea' | 'subtarea' | 'personal';
export type NotaTipo = 'personal' | 'actividad';

export interface Nota {
  id: number;
  titulo: string;
  tipo: NotaTipo;
  scope: NotaScope;
  referenciaId?: number;
  actividadId?: number | null;
  userId: number;
  contenido: string;
  createdAt: string;
  updatedAt?: string | null;
}
