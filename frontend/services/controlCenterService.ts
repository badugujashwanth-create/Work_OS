import apiClient from './apiClient';
import type { IControlCenterDetail, IControlCenterSnapshot } from '@/types';

export const controlCenterService = {
  list: async () => {
    const { data } = await apiClient.get<IControlCenterSnapshot>('/admin/control-center');
    return data;
  },
  getEmployee: async (id: string) => {
    const { data } = await apiClient.get<IControlCenterDetail>(`/admin/control-center/${id}`);
    return data;
  }
};
