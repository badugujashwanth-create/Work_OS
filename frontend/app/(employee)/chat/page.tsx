'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { teamService } from '@/services/teamService';
import { teamChatService } from '@/services/teamChatService';
import { useAuthStore } from '@/store/useAuthStore';
import type { IChannel, ITeamMembership, ITeamMessage } from '@/types';

const panelBase =
  'rounded-3xl border border-slate-200 bg-white/80 shadow-[0_20px_70px_rgba(15,23,42,0.08)]';

const toTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getLastReadKey = (userId: string, channelId: string) =>
  `workhub-chat-lastread:${userId}:${channelId}`;

const readLastRead = (userId: string, channelId: string) => {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(getLastReadKey(userId, channelId));
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const writeLastRead = (userId: string, channelId: string, value: number) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getLastReadKey(userId, channelId), String(value));
};

export default function EmployeeChatPage() {
  const { user } = useAuthStore();
  const [teams, setTeams] = useState<ITeamMembership[]>([]);
  const [channelsByTeam, setChannelsByTeam] = useState<Record<string, IChannel[]>>({});
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ITeamMessage[]>([]);
  const [search, setSearch] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessageByChannel, setLastMessageByChannel] = useState<Record<string, number>>({});
  const [lastReadByChannel, setLastReadByChannel] = useState<Record<string, number>>({});

  const loadTeams = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    setError(null);
    try {
      const memberships = await teamService.myTeams();
      setTeams(memberships);

      const channelsResults = await Promise.all(
        memberships.map((membership) => teamService.channels(membership.team._id))
      );
      const nextChannels: Record<string, IChannel[]> = {};
      memberships.forEach((membership, index) => {
        nextChannels[membership.team._id] = channelsResults[index] || [];
      });
      setChannelsByTeam(nextChannels);

      const initialLastRead: Record<string, number> = {};
      memberships.forEach((membership) => {
        const channels = nextChannels[membership.team._id] || [];
        channels.forEach((channel) => {
          initialLastRead[channel._id] = readLastRead(user._id, channel._id);
        });
      });
      setLastReadByChannel(initialLastRead);

      if (memberships.length > 0) {
        const teamIds = memberships.map((membership) => membership.team._id);
        setSelectedTeamId((prev) =>
          prev && teamIds.includes(prev) ? prev : memberships[0].team._id
        );
      } else {
        setSelectedTeamId(null);
      }

      const unreadSummary = await teamChatService.unread();
      const summaryMap: Record<string, number> = {};
      unreadSummary.forEach((entry) => {
        summaryMap[entry.channelId] = toTimestamp(entry.lastMessageAt);
      });
      setLastMessageByChannel(summaryMap);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load team chat.');
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    if (!selectedTeamId) return;
    const channels = channelsByTeam[selectedTeamId] || [];
    if (channels.length === 0) {
      setSelectedChannelId(null);
      setMessages([]);
      return;
    }
    if (!selectedChannelId || !channels.some((channel) => channel._id === selectedChannelId)) {
      setSelectedChannelId(channels[0]._id);
    }
  }, [channelsByTeam, selectedTeamId, selectedChannelId]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedTeamId || !selectedChannelId) {
        setMessages([]);
        return;
      }
      setLoadingMessages(true);
      setMessagesLoaded(false);
      setError(null);
      try {
        const data = await teamChatService.messages(selectedTeamId, selectedChannelId);
        setMessages(data);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load messages.');
        setMessages([]);
      } finally {
        setLoadingMessages(false);
        setMessagesLoaded(true);
      }
    };

    loadMessages();
  }, [selectedTeamId, selectedChannelId]);

  useEffect(() => {
    if (!messagesLoaded || !selectedChannelId || !user?._id) return;
    const lastMessageAt = messages.length
      ? toTimestamp(messages[messages.length - 1].createdAt)
      : Date.now();
    setLastReadByChannel((prev) => ({ ...prev, [selectedChannelId]: lastMessageAt }));
    writeLastRead(user._id, selectedChannelId, lastMessageAt);
    setLastMessageByChannel((prev) => {
      const existing = prev[selectedChannelId] || 0;
      return lastMessageAt > existing
        ? { ...prev, [selectedChannelId]: lastMessageAt }
        : prev;
    });
  }, [messagesLoaded, messages, selectedChannelId, user?._id]);

  const selectedTeam = teams.find((team) => team.team._id === selectedTeamId) || null;
  const selectedChannel =
    selectedTeamId && selectedChannelId
      ? channelsByTeam[selectedTeamId]?.find((channel) => channel._id === selectedChannelId) || null
      : null;
  const canPost =
    !!selectedChannel &&
    (selectedChannel.type !== 'announcements' ||
      user?.role === 'admin' ||
      ['owner', 'manager'].includes(selectedTeam?.role || 'member'));

  const unreadByChannel = useMemo(() => {
    const result: Record<string, boolean> = {};
    Object.entries(lastMessageByChannel).forEach(([channelId, lastMessageAt]) => {
      const lastRead = lastReadByChannel[channelId] || 0;
      if (lastMessageAt > lastRead) result[channelId] = true;
    });
    return result;
  }, [lastMessageByChannel, lastReadByChannel]);

  const filteredMessages = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return messages;
    return messages.filter((message) => {
      const sender =
        message.sender?.name?.toLowerCase() ||
        message.sender?.email?.toLowerCase() ||
        '';
      return (
        message.text.toLowerCase().includes(term) ||
        sender.includes(term)
      );
    });
  }, [messages, search]);

  const handleSend = async () => {
    if (!selectedTeamId || !selectedChannelId) return;
    if (!canPost) return;
    const trimmed = messageInput.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
      const message = await teamChatService.send({
        teamId: selectedTeamId,
        channelId: selectedChannelId,
        text: trimmed
      });
      setMessages((prev) => [...prev, message]);
      setMessageInput('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Team chat
        </p>
        <h2 className="text-2xl font-semibold text-slate-900">Channels</h2>
        <p className="text-sm text-slate-500">
          Stay aligned with Slack-style team channels and a clean conversation timeline.
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
          <div className="mt-4 space-y-4">
            {teams.length === 0 && !loading && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-500">
                No teams assigned yet.
              </div>
            )}
            {teams.map((membership) => {
              const isSelected = membership.team._id === selectedTeamId;
              const channels = channelsByTeam[membership.team._id] || [];
              return (
                <div
                  key={membership.team._id}
                  className={clsx(
                    'rounded-2xl border px-3 py-3 transition',
                    isSelected
                      ? 'border-brand-300 bg-brand-50/70'
                      : 'border-slate-200 bg-white/70'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTeamId(membership.team._id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {membership.team.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      {membership.role}
                    </span>
                  </button>
                  <div className="mt-3 space-y-1">
                    {channels.length === 0 && (
                      <p className="text-xs text-slate-400">No channels yet.</p>
                    )}
                    {channels.map((channel) => {
                      const active = channel._id === selectedChannelId;
                      const unread = unreadByChannel[channel._id];
                      return (
                        <button
                          key={channel._id}
                          type="button"
                          onClick={() => {
                            setSelectedTeamId(membership.team._id);
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
                          </span>
                          {unread && <span className="h-2 w-2 rounded-full bg-rose-500" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className={`${panelBase} flex min-h-[600px] flex-col p-4`}>
          {selectedChannel && selectedTeam ? (
            <>
              <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-indigo-600/10 to-brand-500/10 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      {selectedTeam.team.name}
                    </p>
                    <h3 className="text-xl font-semibold text-slate-900">
                      #{selectedChannel.name}
                    </h3>
                    <p className="text-xs text-slate-500 capitalize">
                      {selectedChannel.type} channel
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search in channel"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-2xl bg-slate-50/70 p-4">
                {loadingMessages && (
                  <p className="text-center text-sm text-slate-500">Loading messages...</p>
                )}
                {!loadingMessages && filteredMessages.length === 0 && (
                  <p className="text-center text-sm text-slate-500">
                    No messages yet. Start the conversation.
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
                          'max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow',
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
                  placeholder={`Message #${selectedChannel.name}`}
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  disabled={!canPost}
                />
                <button
                  className="rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                  disabled={!messageInput.trim() || sending || !canPost}
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
              {!canPost && (
                <p className="mt-2 text-xs text-amber-600">
                  Only team owners, managers, or admins can post in announcements.
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-500">
              <p className="text-lg font-semibold text-slate-900">
                Select a channel to start chatting
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
