import apiClient from './apiClient';
import { IUsageSummary } from '@/types';

export const usageService = {
  summary: async (date: string, userId?: string) => {
    const params: { date: string; userId?: string } = { date };
    if (userId) params.userId = userId;
    const { data } = await apiClient.get<IUsageSummary>('/usage/summary', { params });
    return data;
  }
};
