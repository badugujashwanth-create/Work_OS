'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { adminTeamService } from '@/services/adminTeamService';
import { adminUserService } from '@/services/adminUserService';
import { useAuthStore } from '@/store/useAuthStore';
import type { IAdminTeam, IChannel, ITeamMember, TeamMemberRole, IUser } from '@/types';

const MEMBER_ROLE_OPTIONS: TeamMemberRole[] = ['owner', 'manager', 'member'];
const CHANNEL_TYPES: Array<IChannel['type']> = ['general', 'announcements', 'project'];

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const isActiveUser = (user: IUser) => !(user.isActive === false || user.isDeactivated);

export default function AdminTeamsPage() {
  const { user, ready } = useAuthStore();
  const [teams, setTeams] = useState<IAdminTeam[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [editTeam, setEditTeam] = useState<IAdminTeam | null>(null);
  const [editName, setEditName] = useState('');
  const [memberForms, setMemberForms] = useState<
    Record<string, { userId: string; role: TeamMemberRole }>
  >({});
  const [channelForms, setChannelForms] = useState<
    Record<string, { name: string; type: IChannel['type'] }>
  >({});

  const canManage = user?.role === 'admin';

  const loadData = useCallback(async () => {
    if (!ready || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      const [teamsData, usersData] = await Promise.all([
        adminTeamService.list(),
        adminUserService.list()
      ]);
      setTeams(teamsData);
      setUsers(usersData);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  }, [ready, canManage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeUsers = useMemo(() => users.filter(isActiveUser), [users]);

  const handleCreateTeam = async () => {
    setCreateError(null);
    setError(null);
    const name = createName.trim();
    if (!name) {
      setCreateError('Team name is required.');
      return;
    }

    try {
      const team = await adminTeamService.create({ name });
      setTeams((prev) => [team, ...prev]);
      setCreateName('');
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || 'Failed to create team.');
    }
  };

  const handleToggleArchive = async (team: IAdminTeam) => {
    setError(null);
    try {
      const updated = await adminTeamService.update(team._id, {
        isArchived: !team.isArchived
      });
      setTeams((prev) => prev.map((item) => (item._id === team._id ? updated : item)));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update team.');
    }
  };

  const handleUpdateTeamName = async () => {
    if (!editTeam) return;
    setError(null);
    const name = editName.trim();
    if (!name) {
      setError('Team name is required.');
      return;
    }
    try {
      const updated = await adminTeamService.update(editTeam._id, { name });
      setTeams((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      setEditTeam(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update team.');
    }
  };

  const handleAddMember = async (team: IAdminTeam) => {
    setError(null);
    const form = memberForms[team._id] || { userId: '', role: 'member' };
    if (!form.userId) {
      setError('Select a user to add.');
      return;
    }
    if (!MEMBER_ROLE_OPTIONS.includes(form.role)) {
      setError('Select a valid member role.');
      return;
    }
    try {
      const response = await adminTeamService.updateMember(team._id, {
        userId: form.userId,
        role: form.role,
        action: 'add'
      });
      const newMember = response.member;
      if (newMember) {
        setTeams((prev) =>
          prev.map((item) =>
            item._id === team._id
              ? {
                  ...item,
                  members: [newMember, ...item.members.filter((member) => member.userId !== form.userId)]
                }
              : item
          )
        );
      }
      setMemberForms((prev) => ({ ...prev, [team._id]: { userId: '', role: 'member' } }));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add member.');
    }
  };

  const handleRemoveMember = async (team: IAdminTeam, member: ITeamMember) => {
    setError(null);
    if (!member.userId) return;
    try {
      await adminTeamService.updateMember(team._id, {
        userId: member.userId,
        action: 'remove'
      });
      setTeams((prev) =>
        prev.map((item) =>
          item._id === team._id
            ? { ...item, members: item.members.filter((entry) => entry.userId !== member.userId) }
            : item
        )
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to remove member.');
    }
  };

  const handleUpdateMemberRole = async (
    team: IAdminTeam,
    member: ITeamMember,
    nextRole: TeamMemberRole
  ) => {
    if (!member.userId || member.role === nextRole) return;
    setError(null);
    try {
      const response = await adminTeamService.updateMember(team._id, {
        userId: member.userId,
        role: nextRole,
        action: 'update'
      });
      const updatedMember = response.member;
      if (updatedMember) {
        setTeams((prev) =>
          prev.map((item) =>
            item._id === team._id
              ? {
                  ...item,
                  members: item.members.map((entry) =>
                    entry.userId === member.userId ? updatedMember : entry
                  )
                }
              : item
          )
        );
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update role.');
    }
  };

  const handleCreateChannel = async (team: IAdminTeam) => {
    setError(null);
    const form = channelForms[team._id] || { name: '', type: 'general' };
    const name = form.name.trim();
    if (!name) {
      setError('Channel name is required.');
      return;
    }
    if (!CHANNEL_TYPES.includes(form.type)) {
      setError('Select a valid channel type.');
      return;
    }
    try {
      const channel = await adminTeamService.createChannel(team._id, {
        name,
        type: form.type
      });
      setTeams((prev) =>
        prev.map((item) =>
          item._id === team._id ? { ...item, channels: [...item.channels, channel] } : item
        )
      );
      setChannelForms((prev) => ({ ...prev, [team._id]: { name: '', type: 'general' } }));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create channel.');
    }
  };

  const handleRenameChannel = async (team: IAdminTeam, channel: IChannel) => {
    const name = window.prompt('Rename channel', channel.name);
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const updated = await adminTeamService.updateChannel(channel._id, { name: trimmed });
      setTeams((prev) =>
        prev.map((item) =>
          item._id === team._id
            ? {
                ...item,
                channels: item.channels.map((entry) =>
                  entry._id === channel._id ? updated : entry
                )
              }
            : item
        )
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to rename channel.');
    }
  };

  const handleToggleChannelArchive = async (team: IAdminTeam, channel: IChannel) => {
    setError(null);
    try {
      const updated = await adminTeamService.updateChannel(channel._id, {
        isArchived: !channel.isArchived
      });
      setTeams((prev) =>
        prev.map((item) =>
          item._id === team._id
            ? {
                ...item,
                channels: item.channels.map((entry) =>
                  entry._id === channel._id ? updated : entry
                )
              }
            : item
        )
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update channel.');
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-800">
        Access denied. Admins only.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Org structure</p>
          <h1 className="text-2xl font-semibold text-slate-900">Teams</h1>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm"
        >
          Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Create team</p>
            <h2 className="text-lg font-semibold text-slate-900">New workspace</h2>
          </div>
          {loading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>
        {createError && (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {createError}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="Team name"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
          />
          <button
            type="button"
            onClick={handleCreateTeam}
            className="rounded-2xl border border-slate-200 bg-slate-900 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white"
          >
            Create team
          </button>
        </div>
      </section>

      {teams.length === 0 && !loading && (
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 text-sm text-slate-500 shadow-sm">
          No teams yet. Create the first team to get started.
        </div>
      )}

      <div className="space-y-6">
        {teams.map((team) => {
          const memberForm = memberForms[team._id] || { userId: '', role: 'member' };
          const channelForm = channelForms[team._id] || { name: '', type: 'general' };
          const memberIds = new Set(team.members.map((member) => member.userId));
          const availableUsers = activeUsers.filter((candidate) => !memberIds.has(candidate._id));
          return (
            <section
              key={team._id}
              className={clsx(
                'rounded-3xl border bg-white/90 p-6 shadow-xl',
                team.isArchived ? 'border-rose-200' : 'border-slate-200'
              )}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Team</p>
                  <h2 className="text-xl font-semibold text-slate-900">{team.name}</h2>
                  <p className="text-xs text-slate-500">Created {formatDate(team.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTeam(team);
                      setEditName(team.name);
                    }}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleArchive(team)}
                    className={clsx(
                      'rounded-full border px-3 py-1 text-xs font-semibold',
                      team.isArchived
                        ? 'border-emerald-200 text-emerald-700'
                        : 'border-rose-200 text-rose-700'
                    )}
                  >
                    {team.isArchived ? 'Activate' : 'Archive'}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Members</p>
                    <h3 className="text-lg font-semibold text-slate-900">Team roster</h3>
                  </div>
                  <div className="space-y-2">
                    {team.members.length === 0 && (
                      <p className="text-sm text-slate-500">No members yet.</p>
                    )}
                    {team.members.map((member) => (
                      <div
                        key={member._id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {member.user?.name || 'Unknown user'}
                          </p>
                          <p className="text-xs text-slate-500">{member.user?.email}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(event) =>
                              handleUpdateMemberRole(
                                team,
                                member,
                                event.target.value as TeamMemberRole
                              )
                            }
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            {MEMBER_ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(team, member)}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Add member
                    </p>
                    <div className="grid gap-2 sm:grid-cols-[1.6fr_1fr_auto]">
                      <select
                        value={memberForm.userId}
                        onChange={(event) =>
                          setMemberForms((prev) => ({
                            ...prev,
                            [team._id]: { ...memberForm, userId: event.target.value }
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        <option value="">Select user</option>
                        {availableUsers.map((candidate) => (
                          <option key={candidate._id} value={candidate._id}>
                            {candidate.name} ({candidate.email})
                          </option>
                        ))}
                      </select>
                      <select
                        value={memberForm.role}
                        onChange={(event) =>
                          setMemberForms((prev) => ({
                            ...prev,
                            [team._id]: { ...memberForm, role: event.target.value as TeamMemberRole }
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        {MEMBER_ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAddMember(team)}
                        className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Channels</p>
                    <h3 className="text-lg font-semibold text-slate-900">Team channels</h3>
                    <p className="text-xs text-slate-500">
                      Announcements can be posted by owners, managers, or admins only.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {team.channels.length === 0 && (
                      <p className="text-sm text-slate-500">No channels yet.</p>
                    )}
                    {team.channels.map((channel) => (
                      <div
                        key={channel._id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            #{channel.name}
                          </p>
                          <p className="text-xs text-slate-500 capitalize">{channel.type}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRenameChannel(team, channel)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleChannelArchive(team, channel)}
                            className={clsx(
                              'rounded-full border px-3 py-1 text-xs font-semibold',
                              channel.isArchived
                                ? 'border-emerald-200 text-emerald-700'
                                : 'border-rose-200 text-rose-700'
                            )}
                          >
                            {channel.isArchived ? 'Activate' : 'Archive'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Create channel
                    </p>
                    <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr_auto]">
                      <input
                        value={channelForm.name}
                        onChange={(event) =>
                          setChannelForms((prev) => ({
                            ...prev,
                            [team._id]: { ...channelForm, name: event.target.value }
                          }))
                        }
                        placeholder="Channel name"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                      />
                      <select
                        value={channelForm.type}
                        onChange={(event) =>
                          setChannelForms((prev) => ({
                            ...prev,
                            [team._id]: {
                              ...channelForm,
                              type: event.target.value as IChannel['type']
                            }
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        {CHANNEL_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleCreateChannel(team)}
                        className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {editTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Rename team</p>
                <h2 className="text-xl font-semibold text-slate-900">{editTeam.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditTeam(null)}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                Close
              </button>
            </div>
            <div className="mt-5 space-y-3">
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="Team name"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditTeam(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateTeamName}
                className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
