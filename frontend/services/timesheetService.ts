import apiClient from './apiClient';
import { ITimeSheetDay } from '@/types';

export const timesheetService = {
  getMe: async (date: string) => {
    const { data } = await apiClient.get<ITimeSheetDay | null>('/timesheet/me', {
      params: { date }
    });
    return data;
  },
  getAdmin: async (date: string) => {
    const { data } = await apiClient.get<ITimeSheetDay[]>('/timesheet/admin', {
      params: { date }
    });
    return data;
  },
  saveNote: async (payload: { date: string; note: string }) => {
    const { data } = await apiClient.patch<ITimeSheetDay>('/timesheet/note', payload);
    return data;
  },
  exportToCSV: async (startDate?: string, endDate?: string) => {
    try {
      const response = await apiClient.get('/timesheet/export', {
        params: { startDate, endDate },
        responseType: 'blob' as any
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data as Blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `timesheet-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Failed to export timesheet', error);
      throw error;
    }
  },
  adminExportToCSV: async (startDate?: string, endDate?: string) => {
    try {
      const response = await apiClient.get('/timesheet/admin/export', {
        params: { startDate, endDate },
        responseType: 'blob' as any
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data as Blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `timesheets-all-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Failed to export timesheets', error);
      throw error;
    }
  }
};
