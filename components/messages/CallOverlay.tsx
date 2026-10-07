"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, X } from "lucide-react";
import { formatDuration } from "@/lib/pulse/call-rules";
import { Avatar } from "@/components/pulse/Avatar";
import { useCall } from "./CallProvider";

function useStream(ref: React.RefObject<HTMLMediaElement | null>, stream: MediaStream | null) {
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [ref, stream]);
}

function Timer({ since }: { since: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-lp-mono text-[13px] tabular-nums" role="timer">{since ? formatDuration((now - since) / 1000) : "00:00"}</span>;
}

const ROUND = "flex h-14 w-14 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/** Ringing, in-call and notice UI for voice and video calls. Mounted once in the app shell. */
export function CallOverlay() {
  const { state, accept, decline, hangup, toggleMute, toggleCamera, dismissNotice } = useCall();
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  useStream(remoteVideo, state.remoteStream);
  useStream(remoteAudio, state.remoteStream);
  useStream(localVideo, state.localStream);
  const { phase, peer, kind } = state;
  const name = peer?.name ?? "Someone";
  const person = peer ?? { name: null, avatarUrl: null };

  return (
    <>
      {state.notice && (
        <div role="alert" className="fixed left-1/2 top-4 z-[70] flex max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl bg-app-charcoal px-4 py-3 text-white shadow-xl">
          <p className="font-lp-body text-[13px]">{state.notice}</p>
          <button type="button" onClick={dismissNotice} aria-label="Dismiss" className="rounded-full p-1 hover:bg-white/10"><X size={14} /></button>
        </div>
      )}

      {phase === "incoming" && (
        <div role="alertdialog" aria-label={`Incoming ${kind} call from ${name}`} className="fixed bottom-6 left-1/2 z-[70] flex w-[min(92vw,380px)] -translate-x-1/2 items-center gap-4 rounded-2xl bg-app-charcoal p-4 text-white shadow-2xl">
          <Avatar person={person} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-lp-body text-[14px] font-semibold">{name}</p>
            <p className="font-lp-body text-[12px] text-white/70">Incoming {kind} call…</p>
          </div>
          <button type="button" onClick={decline} aria-label="Decline call" className={`${ROUND} bg-app-rose text-white hover:opacity-90`}><PhoneOff size={20} /></button>
          <button type="button" onClick={() => void accept()} aria-label="Accept call" autoFocus className={`${ROUND} bg-app-success text-white hover:opacity-90`}>{kind === "video" ? <Video size={20} /> : <Phone size={20} />}</button>
        </div>
      )}

      {(phase === "outgoing" || phase === "connecting" || phase === "active") && (
        <div role="dialog" aria-modal="true" aria-label={`${kind === "video" ? "Video" : "Voice"} call with ${name}`} className="fixed inset-0 z-[70] flex flex-col bg-[#0b0f19] text-white">
          <audio ref={remoteAudio} autoPlay />
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            {kind === "video" && state.remoteStream ? (
              <video ref={remoteVideo} autoPlay playsInline className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Avatar person={person} size="xl" />
                <p className="font-lp-display text-[22px] font-semibold">{name}</p>
              </div>
            )}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-5 py-4">
              <p className="font-lp-body text-[14px] font-semibold">{name}</p>
              <p className="flex items-center gap-2 text-white/80" aria-live="polite">
                {phase === "outgoing" ? "Calling…" : phase === "connecting" ? "Connecting…" : <Timer since={state.startedAt} />}
              </p>
            </div>
            {kind === "video" && state.localStream && !state.cameraOff && (
              <video ref={localVideo} autoPlay playsInline muted className="absolute bottom-4 right-4 h-36 w-28 rounded-xl border border-white/30 object-cover shadow-lg sm:h-44 sm:w-32" style={{ transform: "scaleX(-1)" }} />
            )}
          </div>
          <div className="flex items-center justify-center gap-5 bg-black/40 px-6 py-5">
            <button type="button" onClick={toggleMute} aria-pressed={state.muted} aria-label={state.muted ? "Unmute microphone" : "Mute microphone"} className={`${ROUND} ${state.muted ? "bg-white text-app-charcoal" : "bg-white/15 hover:bg-white/25"}`}>{state.muted ? <MicOff size={22} /> : <Mic size={22} />}</button>
            {kind === "video" && <button type="button" onClick={toggleCamera} aria-pressed={state.cameraOff} aria-label={state.cameraOff ? "Turn camera on" : "Turn camera off"} className={`${ROUND} ${state.cameraOff ? "bg-white text-app-charcoal" : "bg-white/15 hover:bg-white/25"}`}>{state.cameraOff ? <VideoOff size={22} /> : <Video size={22} />}</button>}
            <button type="button" onClick={hangup} aria-label={phase === "outgoing" ? "Cancel call" : "End call"} className={`${ROUND} bg-app-rose text-white hover:opacity-90`}><PhoneOff size={22} /></button>
          </div>
        </div>
      )}
    </>
  );
}
