'use client';

import { PhoneOff, VideoOff, MicOff, CameraOff, PhoneCall } from 'lucide-react';
import type React from 'react';

type CallModalProps = {
  open: boolean;
  callerName: string;
  type: 'audio' | 'video';
  status?: string;
  connectionState?: string;
  remoteAudioRef?: React.RefObject<HTMLAudioElement>;
  remoteVideoRef?: React.RefObject<HTMLVideoElement>;
  localVideoRef?: React.RefObject<HTMLVideoElement>;
  hasVideo?: boolean;
  cameraOff?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
  onToggleCamera?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onEnd?: () => void;
  error?: string;
};

export function CallModal({
  open,
  callerName,
  type,
  status = 'ringing',
  connectionState,
  remoteAudioRef,
  remoteVideoRef,
  localVideoRef,
  hasVideo,
  cameraOff,
  muted,
  onToggleMute,
  onToggleCamera,
  onAccept,
  onReject,
  onEnd,
  error
}: CallModalProps) {
  if (!open) return null;

  const title = type === 'video' ? 'Video Call' : 'Audio Call';
  const rejectLabel = status === 'outgoing' ? 'Cancel' : 'Reject';
  const endLabel = status === 'outgoing' ? 'Cancel' : 'End';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{title}</p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-900">{callerName}</h3>
        <p className="text-sm text-slate-500 capitalize">
          {error ? error : connectionState ? connectionState.replace('_', ' ') : status}
        </p>
        <audio ref={remoteAudioRef} autoPlay className="hidden" />
        {type === 'video' && (
          <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
            {remoteVideoRef ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-contain bg-slate-900"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-200">
                {connectionState === 'in_call' ? 'No remote video' : 'Connecting video...'}
              </div>
            )}
            <div className="absolute bottom-3 right-3 h-28 w-40 overflow-hidden rounded-xl border border-slate-200 bg-black/70">
              {localVideoRef ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[11px] text-slate-200">
                  {hasVideo === false ? 'Audio only' : 'Preview'}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
            >
              <PhoneCall className="h-4 w-4" />
              Accept
            </button>
          )}
          {onReject && (
            <button
              type="button"
              onClick={onReject}
              className="flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700"
            >
              <PhoneOff className="h-4 w-4" />
              {rejectLabel}
            </button>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">In-call controls</p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleMute}
              disabled={!onToggleMute}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-60"
            >
              <MicOff className="h-4 w-4" />
              {muted ? 'Unmute' : 'Mute'}
            </button>
            {type === 'video' && (
              <button
                type="button"
                onClick={onToggleCamera}
                disabled={!onToggleCamera}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-60"
              >
                <CameraOff className="h-4 w-4" />
                {cameraOff ? 'Camera On' : 'Camera Off'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onEnd?.()}
              disabled={!onEnd}
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm disabled:opacity-60"
            >
              <VideoOff className="h-4 w-4" />
              {endLabel}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {connectionState === 'in_call' ? 'Media controls are live.' : 'Preparing media stream.'}
          </p>
        </div>
      </div>
    </div>
  );
}
