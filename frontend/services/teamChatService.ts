import apiClient from './apiClient';
import type { ITeamMessage } from '@/types';

export const teamChatService = {
  messages: async (teamId: string, channelId: string, limit?: number) => {
    const { data } = await apiClient.get<ITeamMessage[]>('/chat/messages', {
      params: {
        teamId,
        channelId,
        ...(limit ? { limit } : {})
      }
    });
    return data;
  },
  send: async (payload: { teamId: string; channelId: string; text: string }) => {
    const { data } = await apiClient.post<ITeamMessage>('/chat/messages', payload);
    return data;
  },
  unread: async (teamId?: string) => {
    const { data } = await apiClient.get<
      { channelId: string; teamId: string; lastMessageAt: string | null }[]
    >('/chat/unread', {
      params: teamId ? { teamId } : undefined
    });
    return data;
  }
};
