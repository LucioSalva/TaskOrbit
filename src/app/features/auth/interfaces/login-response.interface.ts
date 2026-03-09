import { AuthUser } from './auth-user.interface';

export interface LoginResponse {
  ok: boolean;
  message: string;
  data: {
    token: string;
    user: AuthUser;
  };
}
