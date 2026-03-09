export type EstadoTarea =
  | 'por_hacer'
  | 'haciendo'
  | 'terminada'
  | 'enterado'
  | 'ocupado'
  | 'aceptada';

export const ESTADOS_TAREA: EstadoTarea[] = [
  'por_hacer',
  'haciendo',
  'terminada',
  'enterado',
  'ocupado',
  'aceptada'
];

export const ESTADO_LABELS: Record<EstadoTarea, string> = {
  por_hacer: 'Por hacer',
  haciendo: 'Haciendo',
  terminada: 'Terminada',
  enterado: 'Enterado',
  ocupado: 'Ocupado',
  aceptada: 'Aceptada'
};

export const ESTADO_TRANSITIONS: Record<EstadoTarea, EstadoTarea[]> = {
  por_hacer: ['enterado', 'aceptada', 'ocupado', 'haciendo'],
  enterado: ['aceptada', 'ocupado', 'haciendo', 'por_hacer'],
  aceptada: ['ocupado', 'haciendo', 'terminada', 'por_hacer'],
  ocupado: ['haciendo', 'terminada', 'por_hacer'],
  haciendo: ['terminada', 'ocupado', 'por_hacer'],
  terminada: []
};

export const getEstadoLabel = (estado: EstadoTarea | null): string => {
  if (!estado) {
    return 'Sin estado';
  }
  return ESTADO_LABELS[estado];
};

export const getAvailableTransitions = (estado: EstadoTarea | null): EstadoTarea[] => {
  if (!estado) {
    return [];
  }
  return ESTADO_TRANSITIONS[estado] ?? [];
};

export const isTransitionAllowed = (from: EstadoTarea | null, to: EstadoTarea): boolean => {
  if (!from) {
    return false;
  }
  return (ESTADO_TRANSITIONS[from] ?? []).includes(to);
};
