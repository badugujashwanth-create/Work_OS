import apiClient from './apiClient';
import type { IAdminTeam, IChannel, ITeamMember, TeamMemberRole } from '@/types';

export type CreateTeamPayload = {
  name: string;
};

export type UpdateTeamPayload = {
  name?: string;
  isArchived?: boolean;
};

export type TeamMemberAction = 'add' | 'remove' | 'update';

export type TeamMemberPayload = {
  userId: string;
  role?: TeamMemberRole;
  action?: TeamMemberAction;
  remove?: boolean;
};

export type CreateChannelPayload = {
  name: string;
  type?: 'general' | 'announcements' | 'project';
};

export type UpdateChannelPayload = {
  name?: string;
  isArchived?: boolean;
};

export const adminTeamService = {
  list: async () => {
    const { data } = await apiClient.get<IAdminTeam[]>('/admin/teams');
    return data;
  },
  create: async (payload: CreateTeamPayload) => {
    const { data } = await apiClient.post<{ team: IAdminTeam }>('/admin/teams', payload);
    return data.team;
  },
  update: async (id: string, payload: UpdateTeamPayload) => {
    const { data } = await apiClient.put<{ team: IAdminTeam }>(`/admin/teams/${id}`, payload);
    return data.team;
  },
  updateMember: async (teamId: string, payload: TeamMemberPayload) => {
    const { data } = await apiClient.post<{ member?: ITeamMember; success?: boolean }>(
      `/admin/teams/${teamId}/members`,
      payload
    );
    return data;
  },
  createChannel: async (teamId: string, payload: CreateChannelPayload) => {
    const { data } = await apiClient.post<{ channel: IChannel }>(
      `/admin/teams/${teamId}/channels`,
      payload
    );
    return data.channel;
  },
  updateChannel: async (channelId: string, payload: UpdateChannelPayload) => {
    const { data } = await apiClient.put<{ channel: IChannel }>(
      `/admin/channels/${channelId}`,
      payload
    );
    return data.channel;
  }
};
