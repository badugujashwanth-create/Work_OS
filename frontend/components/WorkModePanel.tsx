
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkStore } from '@/store/useWorkStore';
import { useAuthStore } from '@/store/useAuthStore';
import { callService } from '@/services/callService';
import { collabService } from '@/services/collabService';
import { ICallMessage, ICallSession, ICollabFile, ICollabMessage } from '@/types';

type Automation = {
  id: string;
  title: string;
  description: string;
  active: boolean;
};

const sortCalls = (list: ICallSession[]) =>
  [...list].sort((a, b) => {
    const aDate = a.scheduledFor || a.createdAt;
    const bDate = b.scheduledFor || b.createdAt;
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });

export default function WorkModePanel() {
  const { session, loading, startSession, stopSession, trackActivePage, addIdleTime } =
    useWorkStore();
  const { user, ready } = useAuthStore();
  const [pageInfo, setPageInfo] = useState({ url: '', title: '', duration: 5 });
  const [idle, setIdle] = useState(5);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ICollabMessage[]>([]);
  const [calls, setCalls] = useState<ICallSession[]>([]);
  const [activeCall, setActiveCall] = useState<ICallSession | null>(null);
  const callActive = Boolean(activeCall && activeCall.status === 'live');
  const [callTimer, setCallTimer] = useState(0);
  const [automations, setAutomations] = useState<Automation[]>([
    {
      id: 'pulse',
      title: 'Pulse teammates when you go idle',
      description: 'Auto-ping your channel if focus drops for 5+ minutes.',
      active: true
    },
    {
      id: 'summary',
      title: 'Ship meeting summary after calls',
      description: 'AI drafts recap + action items once you hang up.',
      active: false
    },
    {
      id: 'intent',
      title: 'Intent-based window routing',
      description: 'Keeps design/dev tabs grouped per task context.',
      active: true
    }
  ]);
  const [meetingForm, setMeetingForm] = useState({ title: '', time: '', attendees: '' });
  const [sharedFiles, setSharedFiles] = useState<ICollabFile[]>([]);
  const [fileForm, setFileForm] = useState({ name: '', link: '' });
  const [callChatMessages, setCallChatMessages] = useState<ICallMessage[]>([]);
  const [callChatInput, setCallChatInput] = useState('');

  const setActiveCallState = useCallback((call: ICallSession | null) => {
    setActiveCall(call);
    setCallChatMessages([]);
    setCallTimer(0);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const loadCalls = async () => {
      try {
        const data = await callService.list();
        setCalls(sortCalls(data));
        const live = data.find((call) => call.status === 'live');
        setActiveCallState(live || data[0] || null);
      } catch (error) {
        console.error('Failed to load call queue', error);
      }
    };
    loadCalls();
  }, [ready, setActiveCallState]);

  useEffect(() => {
    if (!ready) return;
    collabService
      .listMessages()
      .then(setChatMessages)
      .catch(() => setChatMessages([]));
    collabService
      .listFiles()
      .then(setSharedFiles)
      .catch(() => setSharedFiles([]));
  }, [ready]);

  useEffect(() => {
    if (!activeCall) return;
    let cancelled = false;
    const fetchChat = async () => {
      try {
        const messages = await callService.chat(activeCall._id);
        if (!cancelled) setCallChatMessages(messages);
      } catch (error) {
        console.error('Failed to load call chat', error);
      }
    };
    fetchChat();
    return () => {
      cancelled = true;
    };
  }, [activeCall]);

  useEffect(() => {
    if (!callActive || !activeCall?.startTime) return;
    const startTick = new Date(activeCall.startTime).getTime();
    const tick = () => {
      setCallTimer(Math.max(0, Math.floor((Date.now() - startTick) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [callActive, activeCall?.startTime]);

  const handleSendMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    try {
      const message = await collabService.postMessage({ body: trimmed });
      setChatMessages((prev) => [...prev, message]);
      setChatInput('');
    } catch (error) {
      console.error('Failed to send strategy message', error);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const formatMeetingTime = (value?: string) => {
    if (!value) return 'TBD';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleAutomation = (id: string) => {
    setAutomations((prev) =>
      prev.map((automation) =>
        automation.id === id ? { ...automation, active: !automation.active } : automation
      )
    );
  };

  const handleScheduleMeeting = async () => {
    if (!meetingForm.title.trim() || !meetingForm.time || !meetingForm.attendees.trim()) return;
    const attendees = meetingForm.attendees
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    if (!attendees.length) return;
    try {
      const session = await callService.schedule({
        title: meetingForm.title.trim(),
        scheduledFor: meetingForm.time,
        attendees
      });
      setCalls((prev) => sortCalls([session, ...prev]));
      if (!activeCall) setActiveCallState(session);
      setMeetingForm({ title: '', time: '', attendees: '' });
    } catch (error) {
      console.error('Failed to schedule meeting', error);
    }
  };

  const handleShareFile = async () => {
    if (!fileForm.name.trim()) return;
    try {
      const file = await collabService.postFile({
        name: fileForm.name.trim(),
        link: fileForm.link.trim()
      });
      setSharedFiles((prev) => [file, ...prev]);
      setFileForm({ name: '', link: '' });
    } catch (error) {
      console.error('Failed to share file handoff', error);
    }
  };

  const handleCallChatSend = async () => {
    if (!callChatInput.trim() || !activeCall) return;
    try {
      const message = await callService.postChat(activeCall._id, callChatInput.trim());
      setCallChatMessages((prev) => [...prev, message]);
      setCallChatInput('');
    } catch (error) {
      console.error('Failed to send call note', error);
    }
  };

  const startCall = async () => {
    const target = activeCall || calls[0];
    if (!target) return;
    try {
      const session = await callService.start(target._id);
      setCalls((prev) => sortCalls(prev.map((call) => (call._id === session._id ? session : call))));
      setActiveCallState(session);
    } catch (error) {
      console.error('Failed to start call', error);
    }
  };

  const endCall = async () => {
    if (!activeCall) return;
    try {
      const session = await callService.end(activeCall._id);
      let nextCall: ICallSession | null = null;
      setCalls((prev) => {
        const updated = sortCalls(prev.map((call) => (call._id === session._id ? session : call)));
        nextCall = updated.find((call) => call.status !== 'ended') || null;
        return updated;
      });
      setActiveCallState(nextCall || session);
    } catch (error) {
      console.error('Failed to end call', error);
    }
  };

  const sortedCalls = useMemo(() => sortCalls(calls), [calls]);
  const participants = activeCall?.attendees?.length ? activeCall.attendees : ['You'];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
      <div className="pointer-events-none absolute -left-12 top-0 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Work mode</p>
          <h3 className="text-xl font-semibold text-slate-900">
            {session ? 'Session is live' : 'Stay present & focused'}
          </h3>
          {session && (
            <p className="text-sm text-slate-600">Started at {new Date(session.startTime).toLocaleTimeString()}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
            disabled={loading || Boolean(session)}
            onClick={startSession}
          >
            Start session
          </button>
          <button
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
            disabled={loading || !session}
            onClick={stopSession}
          >
            Stop session
          </button>
        </div>
      </div>

      <div className="relative mt-6 grid gap-4 md:grid-cols-2">
        <form
          className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-inner"
          onSubmit={(e) => {
            e.preventDefault();
            trackActivePage(pageInfo);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active page tracker</p>
              <p className="text-sm text-slate-600">Log the URL, title, and dwell time to refine focus scores.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">Live</span>
          </div>
          <div className="mt-4 space-y-2">
            <input
              required
              placeholder="URL"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:-translate-y-0.5 focus:border-brand-500 focus:bg-white focus:shadow-lg"
              value={pageInfo.url}
              onChange={(e) => setPageInfo((prev) => ({ ...prev, url: e.target.value }))}
            />
            <input
              placeholder="Page title"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:-translate-y-0.5 focus:border-brand-500 focus:bg-white focus:shadow-lg"
              value={pageInfo.title}
              onChange={(e) => setPageInfo((prev) => ({ ...prev, title: e.target.value }))}
            />
            <input
              type="number"
              min={1}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:-translate-y-0.5 focus:border-brand-500 focus:bg-white focus:shadow-lg"
              value={pageInfo.duration}
              onChange={(e) => setPageInfo((prev) => ({ ...prev, duration: Number(e.target.value) }))}
            />
          </div>
          <button className="mt-4 w-full rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 focus:ring-2 focus:ring-brand-200 focus:ring-offset-2 focus:ring-offset-white">
            Log page
          </button>
        </form>

        <form
          className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-inner"
          onSubmit={(e) => {
            e.preventDefault();
            addIdleTime(idle);
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Idle time</p>
          <p className="text-sm text-slate-600">Fill in idle minutes so your focus score stays fair and transparent.</p>
          <div className="mt-4 space-y-2">
            <input
              type="number"
              min={1}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:-translate-y-0.5 focus:border-brand-500 focus:bg-white focus:shadow-lg"
              value={idle}
              onChange={(e) => setIdle(Number(e.target.value))}
            />
          </div>
          <button className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 focus:ring-offset-white">
            Add idle minutes
          </button>
        </form>
      </div>

      <div className="relative mt-6 grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/60 p-5 shadow-inner">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Team chat</p>
              <h4 className="text-lg font-semibold text-slate-900">Strategy room</h4>
              <p className="text-sm text-slate-600">Keep async and live collab in one OS-grade feed.</p>
            </div>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-700">Always-on</span>
          </div>
          <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
            {chatMessages.map((message) => {
              const isSelf = message.author?._id === user?._id;
              return (
                <div
                  key={message._id}
                  className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow ${
                      isSelf
                        ? 'bg-brand-600 text-white shadow-brand-600/30'
                        : 'bg-white text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500/80">
                      <span className="font-semibold text-xs text-slate-500">
                        {message.author?.name || message.author?.email || 'Teammate'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{message.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <form
            className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <input
              className="flex-1 border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Drop a quick update or @mention your pod..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
              disabled={!chatInput.trim()}
            >
              Send
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-inner">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pro call hub</p>
                <h4 className="text-lg font-semibold text-slate-900">Voice room</h4>
                <p className="text-sm text-slate-600">
                  {callActive ? `Live for ${formatTimer(callTimer)}` : 'Ready for the next sync window.'}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  callActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {callActive ? 'On air' : 'Standby'}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p className="font-semibold text-slate-500">Participants</p>
              <ul className="space-y-1 text-slate-700">
                {participants.map((attendee) => (
                  <li key={attendee}>? {attendee}</li>
                ))}
              </ul>
              <p className="pt-2 text-xs uppercase tracking-[0.2em] text-slate-400">Agenda</p>
              <ol className="list-decimal space-y-1 pl-4 text-slate-700">
                <li>Review blockers & pulse metrics</li>
                <li>Update client-ready mockups</li>
                <li>Confirm next sprint focus</li>
              </ol>
            </div>
            <button
              className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 ${
                callActive ? 'bg-rose-600' : 'bg-brand-600'
              }`}
              onClick={callActive ? endCall : startCall}
              type="button"
              disabled={!activeCall && sortedCalls.length === 0}
            >
              {callActive ? 'End call for everyone' : 'Start secure call'}
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-inner">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Meeting cockpit</p>
                <h4 className="text-lg font-semibold text-slate-900">Arrange ? Share ? Align</h4>
                <p className="text-sm text-slate-600">
                  Spin up the next sync, drop assets, and keep pre-call chat close to the audio room.
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-600">
                Professional mode
              </span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Upcoming meetings</p>
                  <span className="text-xs font-semibold text-brand-600">{sortedCalls.length}</span>
                </div>
                <ul className="mt-3 space-y-3">
                  {sortedCalls.map((meeting) => (
                    <button
                      key={meeting._id}
                      type="button"
                      onClick={() => setActiveCallState(meeting)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left text-sm shadow-sm transition ${
                        activeCall?._id === meeting._id
                          ? 'border-brand-200 bg-brand-50/70'
                          : 'border-slate-100 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-900">{meeting.title}</p>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                            meeting.status === 'live'
                              ? 'bg-emerald-100 text-emerald-700'
                              : meeting.status === 'scheduled'
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {meeting.status === 'live'
                            ? 'Live'
                            : meeting.status === 'scheduled'
                              ? 'Queued'
                              : 'Ended'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatMeetingTime(meeting.scheduledFor || meeting.createdAt)} ? {meeting.channel}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {meeting.attendees.length ? meeting.attendees.join(', ') : 'No attendees'}
                      </p>
                    </button>
                  ))}
                </ul>
              </div>

              <form
                className="rounded-2xl border border-slate-200 bg-white/70 p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleScheduleMeeting();
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Schedule next sync</p>
                <div className="mt-3 space-y-2">
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-500 focus:shadow-lg"
                    placeholder="Meeting title"
                    value={meetingForm.title}
                    onChange={(e) => setMeetingForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-500 focus:shadow-lg"
                    value={meetingForm.time}
                    onChange={(e) => setMeetingForm((prev) => ({ ...prev, time: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-500 focus:shadow-lg"
                    placeholder="Attendees (comma separated)"
                    value={meetingForm.attendees}
                    onChange={(e) => setMeetingForm((prev) => ({ ...prev, attendees: e.target.value }))}
                  />
                </div>
                <button className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5">
                  Add to call queue
                </button>
              </form>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">File handoffs</p>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Secure share</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {sharedFiles.map((file) => (
                    <li key={file._id} className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-slate-900">{file.name}</span>
                        <span>
                          {new Date(file.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {file.owner?.name || file.owner?.email || 'Teammate'}
                      </p>
                      <p className="text-xs text-brand-600">{file.link}</p>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleShareFile();
                  }}
                >
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500"
                    placeholder="File name or deliverable"
                    value={fileForm.name}
                    onChange={(e) => setFileForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500"
                    placeholder="Link or storage hint"
                    value={fileForm.link}
                    onChange={(e) => setFileForm((prev) => ({ ...prev, link: e.target.value }))}
                  />
                  <button className="w-full rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow">
                    Share file with room
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Call-side chat</p>
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${callActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {callActive ? 'linked to live call' : 'asynchronous'}
                  </span>
                </div>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                  {callChatMessages.map((note) => (
                    <div key={note._id} className="rounded-2xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                        <span className="font-semibold text-slate-600">{note.author?.name || 'Teammate'}</span>
                        <span>
                          {new Date(note.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{note.body}</p>
                    </div>
                  ))}
                </div>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCallChatSend();
                  }}
                >
                  <input
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500"
                    placeholder={activeCall ? 'Drop prep note or @mention' : 'Select a call to chat'}
                    value={callChatInput}
                    onChange={(e) => setCallChatInput(e.target.value)}
                    disabled={!activeCall}
                  />
                  <button
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                    disabled={!callChatInput.trim() || !activeCall}
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-inner">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Automations</p>
                <h4 className="text-lg font-semibold text-slate-900">OS orchestration</h4>
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Live</span>
            </div>
            <div className="mt-4 space-y-3">
              {automations.map((automation) => (
                <button
                  key={automation.id}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 ${
                    automation.active ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'
                  }`}
                  type="button"
                  onClick={() => toggleAutomation(automation.id)}
                >
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                    {automation.title}
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wide ${
                        automation.active ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {automation.active ? 'On' : 'Off'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{automation.description}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
