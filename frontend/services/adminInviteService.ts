import apiClient from './apiClient';
import type { IInvite } from '@/types';

export type AdminInvitePayload = {
  email: string;
  role: string;
};

export type AdminInviteResponse = {
  invite: IInvite;
  inviteLink: string;
};

export const adminInviteService = {
  list: async () => {
    const { data } = await apiClient.get<IInvite[]>('/admin/invites');
    return data;
  },
  create: async (payload: AdminInvitePayload) => {
    const { data } = await apiClient.post<AdminInviteResponse>('/admin/invites', payload);
    return data;
  }
};
