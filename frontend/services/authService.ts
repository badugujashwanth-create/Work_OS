import apiClient from './apiClient';
import { IUser } from '@/types';

export type LoginPayload = { email: string; password: string };
export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'manager' | 'employee' | 'hr';
};
export type AcceptInvitePayload = {
  token: string;
  name: string;
  password: string;
};

export type AuthResponse = { token: string; refreshToken: string; user: IUser };
export type AcceptInviteResponse = { success: boolean; userId: string; email: string };

export const authService = {
  login: async (payload: LoginPayload) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    return data;
  },
  register: async (payload: RegisterPayload) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
    return data;
  },
  acceptInvite: async (payload: AcceptInvitePayload) => {
    const { data } = await apiClient.post<AcceptInviteResponse>('/auth/accept-invite', payload);
    return data;
  },
  refresh: async (refreshToken: string) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/refresh', { refreshToken });
    return data;
  },
  logout: async (refreshToken?: string) => {
    await apiClient.post('/auth/logout', { refreshToken });
  },
  me: async () => {
    const { data } = await apiClient.get<{ user: IUser }>('/auth/me');
    return data.user;
  }
};
