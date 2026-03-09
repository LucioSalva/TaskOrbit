import { UserRole } from '../../auth/interfaces/auth-user.interface';

export interface CreateUser {
  nombre_completo: string;
  username: string;
  telefono: string;
  password?: string;
  rol: UserRole;
  activo: boolean;
}
