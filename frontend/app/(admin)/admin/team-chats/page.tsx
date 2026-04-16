'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { adminChatService, type AdminChatTeam } from '@/services/adminChatService';
import { useAuthStore } from '@/store/useAuthStore';
import type { IChannel, ITeamMessage } from '@/types';

const panelBase =
  'rounded-3xl border border-slate-200 bg-white/80 shadow-[0_20px_70px_rgba(15,23,42,0.08)]';

const sortChannels = (channels: IChannel[]) =>
  [...channels].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    if (a.type === 'announcements') return -1;
    if (b.type === 'announcements') return 1;
    return a.type.localeCompare(b.type);
  });

export default function AdminTeamChatsPage() {
  const { user } = useAuthStore();
  const [teams, setTeams] = useState<AdminChatTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ITeamMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [allowPost, setAllowPost] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminChatService.listTeams(includeArchived);
      setTeams(data);
      if (data.length > 0) {
        const teamIds = data.map((team) => team._id);
        setSelectedTeamId((prev) => (prev && teamIds.includes(prev) ? prev : data[0]._id));
      } else {
        setSelectedTeamId(null);
        setSelectedChannelId(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team._id === selectedTeamId) || null,
    [teams, selectedTeamId]
  );

  useEffect(() => {
    if (!selectedTeam) {
      setSelectedChannelId(null);
      return;
    }
    const channels = sortChannels(selectedTeam.channels || []);
    if (channels.length === 0) {
      setSelectedChannelId(null);
      return;
    }
    setSelectedChannelId((prev) =>
      prev && channels.some((channel) => channel._id === prev) ? prev : channels[0]._id
    );
  }, [selectedTeam]);

  const selectedChannel = useMemo(() => {
    if (!selectedTeam || !selectedChannelId) return null;
    return selectedTeam.channels.find((channel) => channel._id === selectedChannelId) || null;
  }, [selectedTeam, selectedChannelId]);

  const dateRange = useMemo(() => {
    if (!dateFrom || !dateTo) return undefined;
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined;
    end.setHours(23, 59, 59, 999);
    return `${start.toISOString()},${end.toISOString()}`;
  }, [dateFrom, dateTo]);

  const loadMessages = useCallback(async () => {
    if (!selectedTeamId || !selectedChannelId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    setError(null);
    try {
      const data = await adminChatService.messages({
        teamId: selectedTeamId,
        channelId: selectedChannelId,
        ...(dateRange ? { dateRange } : {})
      });
      setMessages(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load messages.');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedTeamId, selectedChannelId, dateRange]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const filteredMessages = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return messages;
    return messages.filter((message) => {
      const sender =
        message.sender?.name?.toLowerCase() ||
        message.sender?.email?.toLowerCase() ||
        '';
      return message.text.toLowerCase().includes(term) || sender.includes(term);
    });
  }, [messages, search]);

  const canPost =
    allowPost &&
    selectedChannel?.type === 'announcements' &&
    user?.role === 'admin' &&
    !selectedChannel?.isArchived &&
    !selectedTeam?.isArchived;

  const handleSend = async () => {
    if (!canPost || !selectedTeamId || !selectedChannelId) return;
    const trimmed = messageInput.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
      const message = await adminChatService.postAnnouncement({
        teamId: selectedTeamId,
        channelId: selectedChannelId,
        text: trimmed
      });
      setMessages((prev) => [...prev, message]);
      setMessageInput('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to post announcement.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          All team chats
        </p>
        <h2 className="text-2xl font-semibold text-slate-900">Team chat archive</h2>
        <p className="text-sm text-slate-500">
          Review every team channel in one place. Messages are read-only unless you enable
          announcements.
        </p>
      </header>

      {error && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className={`${panelBase} p-4`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Teams
            </p>
            {loading && <span className="text-xs text-slate-400">Loading...</span>}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <span>Show archived</span>
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
              className="h-4 w-4"
            />
          </div>
          <div className="mt-4 space-y-4">
            {teams.length === 0 && !loading && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-500">
                No teams available.
              </div>
            )}
            {teams.map((team) => {
              const isSelected = team._id === selectedTeamId;
              const channels = sortChannels(team.channels || []);
              return (
                <div
                  key={team._id}
                  className={clsx(
                    'rounded-2xl border px-3 py-3 transition',
                    isSelected ? 'border-brand-300 bg-brand-50/70' : 'border-slate-200 bg-white/70'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTeamId(team._id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="text-sm font-semibold text-slate-900">{team.name}</span>
                    {team.isArchived && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-500">
                        Archived
                      </span>
                    )}
                  </button>
                  <div className="mt-3 space-y-1">
                    {channels.length === 0 && (
                      <p className="text-xs text-slate-400">No channels yet.</p>
                    )}
                    {channels.map((channel) => {
                      const active = channel._id === selectedChannelId;
                      return (
                        <button
                          key={channel._id}
                          type="button"
                          onClick={() => {
                            setSelectedTeamId(team._id);
                            setSelectedChannelId(channel._id);
                          }}
                          className={clsx(
                            'flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition',
                            active
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700'
                          )}
                        >
                          <span className="flex items-center gap-2">
                            # {channel.name}
                            {channel.type === 'announcements' && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                                Ann
                              </span>
                            )}
                            {channel.isArchived && (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] uppercase text-slate-500">
                                Archived
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className={`${panelBase} flex min-h-[640px] flex-col p-4`}>
          {selectedChannel && selectedTeam ? (
            <>
              <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-indigo-600/10 to-brand-500/10 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      {selectedTeam.name}
                    </p>
                    <h3 className="text-xl font-semibold text-slate-900">
                      #{selectedChannel.name}
                    </h3>
                    <p className="text-xs text-slate-500 capitalize">
                      {selectedChannel.type} channel
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search messages"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm"
                    />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => setDateFrom(event.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={loadMessages}
                      className="rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
                    >
                      Apply
                    </button>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <input
                    type="checkbox"
                    checked={allowPost}
                    onChange={(event) => setAllowPost(event.target.checked)}
                    className="h-4 w-4"
                  />
                  Enable announcements posting
                </label>
              </div>

              <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-2xl bg-slate-50/70 p-4">
                {loadingMessages && (
                  <p className="text-center text-sm text-slate-500">Loading messages...</p>
                )}
                {!loadingMessages && filteredMessages.length === 0 && (
                  <p className="text-center text-sm text-slate-500">
                    No messages available for this channel.
                  </p>
                )}
                {filteredMessages.map((message) => {
                  const isMine = message.senderId === user?._id;
                  return (
                    <div
                      key={message._id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={clsx(
                          'max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow',
                          isMine ? 'bg-brand-600 text-white' : 'bg-white text-slate-900'
                        )}
                      >
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500/70">
                          <span className="font-semibold">
                            {message.sender?.name ||
                              message.sender?.email ||
                              'Teammate'}
                          </span>
                          <span className="text-[10px]">
                            {new Date(message.createdAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="mt-1 text-sm">{message.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSend();
                }}
              >
                <input
                  className="flex-1 border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder={
                    selectedChannel.type === 'announcements'
                      ? 'Post announcement...'
                      : 'Read-only channel'
                  }
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  disabled={!canPost}
                />
                <button
                  className="rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                  disabled={!messageInput.trim() || sending || !canPost}
                >
                  {sending ? 'Sending...' : 'Post'}
                </button>
              </form>
              {!canPost && (
                <p className="mt-2 text-xs text-amber-600">
                  Announcements posting is disabled or this channel is read-only.
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-500">
              <p className="text-lg font-semibold text-slate-900">
                Select a team channel to view messages
              </p>
              <p className="text-sm text-slate-500">
                Choose a team and channel from the left sidebar.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
