import apiClient from './apiClient';

type ExportRange = { startDate: string; endDate: string; teamId?: string; userId?: string };

export const exportService = {
  timesheets: async (params: ExportRange) => {
    const { data } = await apiClient.get('/admin/exports/timesheets', { params });
    return data;
  },
  leave: async (params: ExportRange) => {
    const { data } = await apiClient.get('/admin/exports/leave', { params });
    return data;
  },
  usage: async (params: ExportRange) => {
    const { data } = await apiClient.get('/admin/exports/usage', { params });
    return data;
  }
};
