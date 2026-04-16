import apiClient from './apiClient';
import { IAdminUserResponse, IUser } from '@/types';

export type AdminUserPayload = {
  name: string;
  email: string;
  role: string;
  tempPassword?: string;
};

export type AdminUserUpdatePayload = {
  name?: string;
  email?: string;
  role?: string;
  resetPassword?: boolean;
  isActive?: boolean;
};

export const adminUserService = {
  list: async () => {
    const { data } = await apiClient.get<IUser[]>('/admin/users');
    return data;
  },
  create: async (payload: AdminUserPayload) => {
    const { data } = await apiClient.post<IAdminUserResponse>('/admin/users', payload);
    return data;
  },
  update: async (id: string, payload: AdminUserUpdatePayload) => {
    const { data } = await apiClient.put<IAdminUserResponse>(`/admin/users/${id}`, payload);
    return data;
  },
  deactivate: async (id: string) => {
    const { data } = await apiClient.delete<{ success: boolean }>(`/admin/users/${id}`);
    return data;
  }
};
