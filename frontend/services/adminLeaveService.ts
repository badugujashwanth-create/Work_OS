import apiClient from './apiClient';
import type { ILeaveBalance, ILeaveType } from '@/types';

export type CreateLeaveTypePayload = {
  name: string;
  paid?: boolean;
  defaultAnnualDays?: number;
};

export type UpdateLeaveTypePayload = {
  name?: string;
  paid?: boolean;
  isActive?: boolean;
  defaultAnnualDays?: number;
};

export type AdjustLeaveBalancePayload = {
  userId: string;
  leaveTypeId: string;
  year?: number;
  totalDays?: number;
  usedDays?: number;
};

export const adminLeaveService = {
  listTypes: async () => {
    const { data } = await apiClient.get<ILeaveType[]>('/admin/leave-types');
    return data;
  },
  createType: async (payload: CreateLeaveTypePayload) => {
    const { data } = await apiClient.post<ILeaveType>('/admin/leave-types', payload);
    return data;
  },
  updateType: async (id: string, payload: UpdateLeaveTypePayload) => {
    const { data } = await apiClient.put<ILeaveType>(`/admin/leave-types/${id}`, payload);
    return data;
  },
  deactivateType: async (id: string) => {
    const { data } = await apiClient.delete<{ success: boolean }>(`/admin/leave-types/${id}`);
    return data;
  },
  adjustBalance: async (payload: AdjustLeaveBalancePayload) => {
    const { data } = await apiClient.post<ILeaveBalance>('/admin/leave/balances/adjust', payload);
    return data;
  }
};
