import apiClient from './apiClient';
import type {
  ILeaveBalance,
  ILeaveRequest,
  ILeaveType,
  LeaveDurationType,
  LeaveRequestStatus
} from '@/types';

export type CreateLeaveRequestPayload = {
  leaveTypeId: string;
  startAt: string;
  endAt?: string;
  durationType?: LeaveDurationType;
  hoursRequested?: number;
  reason?: string;
  attachmentUrl?: string;
};

export type LeaveDecisionPayload = {
  comment?: string;
};

export type LeaveRequestQuery = {
  status?: LeaveRequestStatus;
  teamId?: string;
};

export const leaveService = {
  listTypes: async () => {
    const { data } = await apiClient.get<ILeaveType[]>('/leave/types');
    return data;
  },
  listBalances: async (year?: number) => {
    const { data } = await apiClient.get<ILeaveBalance[]>('/leave/balances/me', {
      params: year ? { year } : undefined
    });
    return data;
  },
  listMyRequests: async () => {
    const { data } = await apiClient.get<ILeaveRequest[]>('/leave/requests/me');
    return data;
  },
  createRequest: async (payload: CreateLeaveRequestPayload) => {
    const { data } = await apiClient.post<ILeaveRequest>('/leave/requests', payload);
    return data;
  },
  cancelRequest: async (id: string) => {
    const { data } = await apiClient.post<ILeaveRequest>(`/leave/requests/${id}/cancel`);
    return data;
  },
  listRequests: async (params?: LeaveRequestQuery) => {
    const { data } = await apiClient.get<ILeaveRequest[]>('/leave/requests', { params });
    return data;
  },
  managerApprove: async (id: string, payload?: LeaveDecisionPayload) => {
    const { data } = await apiClient.post<ILeaveRequest>(`/leave/requests/${id}/manager-approve`, payload || {});
    return data;
  },
  managerReject: async (id: string, payload?: LeaveDecisionPayload) => {
    const { data } = await apiClient.post<ILeaveRequest>(`/leave/requests/${id}/manager-reject`, payload || {});
    return data;
  },
  adminApprove: async (id: string, payload?: LeaveDecisionPayload) => {
    const { data } = await apiClient.post<ILeaveRequest>(`/leave/requests/${id}/admin-approve`, payload || {});
    return data;
  },
  adminReject: async (id: string, payload?: LeaveDecisionPayload) => {
    const { data } = await apiClient.post<ILeaveRequest>(`/leave/requests/${id}/admin-reject`, payload || {});
    return data;
  }
};
