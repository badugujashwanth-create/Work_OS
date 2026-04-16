import apiClient from './apiClient';
import type { IChannel, ITeamMembership } from '@/types';

export const teamService = {
  myTeams: async () => {
    const { data } = await apiClient.get<ITeamMembership[]>('/teams/me');
    return data;
  },
  channels: async (teamId: string) => {
    const { data } = await apiClient.get<IChannel[]>(`/teams/${teamId}/channels`);
    return data;
  }
};
