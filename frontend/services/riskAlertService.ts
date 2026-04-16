import apiClient from './apiClient';
import type { IRiskAlert, RiskAlertStatus } from '@/types';

export type SnoozePayload = {
  hours?: number;
  days?: number;
  until?: string;
  note?: string;
};

export const riskAlertService = {
  list: async (status: RiskAlertStatus | 'all' = 'open') => {
    const { data } = await apiClient.get<IRiskAlert[]>('/admin/risk-alerts', {
      params: { status }
    });
    return data;
  },
  resolve: async (id: string, note?: string) => {
    const { data } = await apiClient.post<IRiskAlert>(`/admin/risk-alerts/${id}/resolve`, { note });
    return data;
  },
  snooze: async (id: string, payload: SnoozePayload) => {
    const { data } = await apiClient.post<IRiskAlert>(`/admin/risk-alerts/${id}/snooze`, payload);
    return data;
  },
  addNote: async (id: string, note: string) => {
    const { data } = await apiClient.post<IRiskAlert>(`/admin/risk-alerts/${id}/note`, { note });
    return data;
  }
};
