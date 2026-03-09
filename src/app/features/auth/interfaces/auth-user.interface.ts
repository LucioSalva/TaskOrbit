export type UserRole = 'GOD' | 'ADMIN' | 'USER';

export interface AuthUser {
  id: number;
  username: string;
  nombre_completo: string;
  rol: UserRole;
}
