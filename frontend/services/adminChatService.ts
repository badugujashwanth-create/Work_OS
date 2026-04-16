import apiClient from './apiClient';
import type { IChannel, ITeam, ITeamMessage } from '@/types';

export type AdminChatTeam = ITeam & { channels: IChannel[] };

export const adminChatService = {
  listTeams: async (includeArchived?: boolean) => {
    const { data } = await apiClient.get<AdminChatTeam[]>('/admin/chat/teams', {
      params: includeArchived ? { includeArchived: true } : undefined
    });
    return data;
  },
  messages: async (params: { teamId: string; channelId: string; dateRange?: string }) => {
    const { data } = await apiClient.get<ITeamMessage[]>('/admin/chat/messages', {
      params
    });
    return data;
  },
  postAnnouncement: async (payload: { teamId: string; channelId: string; text: string }) => {
    const { data } = await apiClient.post<ITeamMessage>('/admin/chat/messages', payload);
    return data;
  }
};
