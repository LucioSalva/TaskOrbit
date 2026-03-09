import { UserRole } from '../../auth/interfaces/auth-user.interface';

export interface User {
  id: number;
  nombre_completo: string;
  username: string;
  telefono: string;
  rol: UserRole;
  activo: boolean;
}
