"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CallKind } from "@/lib/pulse/call-rules";
import { RING_SECONDS } from "@/lib/pulse/call-rules";
import type { PersonSummary } from "@/lib/pulse/people";
import { useMessaging } from "./MessagingProvider";

export type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "active";
export interface CallState {
  phase: CallPhase;
  kind: CallKind;
  peer: PersonSummary | null;
  muted: boolean;
  cameraOff: boolean;
  /** when the media connected, for the timer */
  startedAt: number | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** a message to show once, e.g. why a call could not start */
  notice: string | null;
}
interface Ctx {
  state: CallState;
  /** this browser can place calls (secure context and media devices) */
  supported: boolean;
  startCall: (peer: PersonSummary, kind: CallKind) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  dismissNotice: () => void;
}

const IDLE: CallState = { phase: "idle", kind: "voice", peer: null, muted: false, cameraOff: false, startedAt: null, localStream: null, remoteStream: null, notice: null };
const CallContext = createContext<Ctx | null>(null);
export function useCall(): Ctx {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

const INCOMING_TIMEOUT_MS = (RING_SECONDS + 5) * 1000;
const OFFER_TIMEOUT_MS = 20_000;
const DISCONNECT_GRACE_MS = 10_000;
type Ice = { iceServers: RTCIceServer[] };

const post = (url: string, body?: unknown, keepalive = false) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), keepalive });

function mediaMessage(error: unknown): string {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "Allow microphone and camera access in your browser to make calls.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone or camera was found on this device.";
  if (name === "NotReadableError") return "Your microphone or camera is being used by another app.";
  return "Couldn't access your microphone or camera.";
}

/** A soft two-tone ring while a call rings. Browsers only allow sound after the person has used the page, so this fails silently otherwise. */
function useRingtone(on: boolean) {
  useEffect(() => {
    if (!on) return;
    let ctx: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    try {
      ctx = new AudioContext();
      const beep = () => {
        if (!ctx) return;
        for (const [i, freq] of [440, 480].entries()) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.25);
          gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + i * 0.25 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.25 + 0.22);
          osc.connect(gain).connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.25);
          osc.stop(ctx.currentTime + i * 0.25 + 0.25);
        }
      };
      beep();
      timer = setInterval(beep, 2000);
    } catch {
      /* no audio available */
    }
    return () => {
      if (timer) clearInterval(timer);
      void ctx?.close().catch(() => undefined);
    };
  }, [on]);
}

/**
 * One-to-one voice and video calls. Signalling (offer, answer, ICE candidates) travels through the server over each person's private
 * channel; the media itself goes peer to peer, or through the TURN relay when a network blocks that.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { subscribe } = useMessaging();
  const [state, setState] = useState<CallState>(IDLE);
  const [supported] = useState(() => typeof window !== "undefined" && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia) && typeof RTCPeerConnection !== "undefined");

  const callId = useRef<string | null>(null);
  const role = useRef<"caller" | "callee" | null>(null);
  const ice = useRef<Ice | null>(null);
  const kindRef = useRef<CallKind>("voice");
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const timers = useRef<{ ring?: ReturnType<typeof setTimeout>; offer?: ReturnType<typeof setTimeout>; drop?: ReturnType<typeof setTimeout> }>({});
  const acceptedHere = useRef(false);

  const clearTimers = () => {
    for (const t of Object.values(timers.current)) if (t) clearTimeout(t);
    timers.current = {};
  };

  const cleanup = useCallback((notice: string | null = null) => {
    clearTimers();
    pc.current?.close();
    pc.current = null;
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    pendingCandidates.current = [];
    callId.current = null;
    role.current = null;
    ice.current = null;
    acceptedHere.current = false;
    setState({ ...IDLE, notice });
  }, []);

  const send = useCallback((kind: "offer" | "answer" | "candidate", data: unknown) => {
    if (callId.current) void post(`/api/pulse/calls/${callId.current}/signal`, { kind, data });
  }, []);

  const createPeer = useCallback(() => {
    const peer = new RTCPeerConnection({ iceServers: ice.current?.iceServers ?? [] });
    pc.current = peer;
    local.current?.getTracks().forEach((t) => peer.addTrack(t, local.current as MediaStream));
    peer.onicecandidate = (e) => {
      if (e.candidate) send("candidate", e.candidate.toJSON());
    };
    peer.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      setState((s) => ({ ...s, remoteStream: stream }));
    };
    peer.onconnectionstatechange = () => {
      if (timers.current.drop) clearTimeout(timers.current.drop);
      if (peer.connectionState === "connected") {
        if (timers.current.offer) clearTimeout(timers.current.offer);
        setState((s) => (s.phase === "active" ? s : { ...s, phase: "active", startedAt: Date.now() }));
      } else if (peer.connectionState === "failed") {
        if (callId.current) void post(`/api/pulse/calls/${callId.current}/end`);
        cleanup("The call couldn't connect. Check your connection and try again.");
      } else if (peer.connectionState === "disconnected") {
        timers.current.drop = setTimeout(() => {
          if (callId.current) void post(`/api/pulse/calls/${callId.current}/end`);
          cleanup("The call dropped.");
        }, DISCONNECT_GRACE_MS);
      }
    };
    return peer;
  }, [cleanup, send]);

  const flushCandidates = useCallback(async () => {
    const peer = pc.current;
    if (!peer?.remoteDescription) return;
    for (const c of pendingCandidates.current.splice(0)) await peer.addIceCandidate(c).catch(() => undefined);
  }, []);

  const getMedia = useCallback(async (kind: CallKind) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: kind === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false });
    local.current = stream;
    return stream;
  }, []);

  const startCall = useCallback(async (peer: PersonSummary, kind: CallKind) => {
    if (state.phase !== "idle" || !supported) return;
    let stream: MediaStream;
    try {
      stream = await getMedia(kind);
    } catch (error) {
      return setState({ ...IDLE, notice: mediaMessage(error) });
    }
    try {
      const res = await post("/api/pulse/calls", { userId: peer.id, kind });
      const json = (await res.json().catch(() => null)) as { call?: { id: string }; ice?: Ice; error?: string } | null;
      if (!res.ok || !json?.call) {
        stream.getTracks().forEach((t) => t.stop());
        local.current = null;
        return setState({ ...IDLE, notice: json?.error ?? "Couldn't start the call." });
      }
      callId.current = json.call.id;
      role.current = "caller";
      ice.current = json.ice ?? null;
      kindRef.current = kind;
      setState({ ...IDLE, phase: "outgoing", kind, peer, localStream: stream });
      timers.current.ring = setTimeout(() => {
        if (callId.current) void post(`/api/pulse/calls/${callId.current}/end`);
        cleanup("No answer.");
      }, RING_SECONDS * 1000);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      local.current = null;
      setState({ ...IDLE, notice: "Couldn't reach the server." });
    }
  }, [state.phase, supported, getMedia, cleanup]);

  const accept = useCallback(async () => {
    if (state.phase !== "incoming" || !callId.current) return;
    const id = callId.current;
    let stream: MediaStream;
    try {
      stream = await getMedia(kindRef.current);
    } catch (error) {
      void post(`/api/pulse/calls/${id}/respond`, { action: "decline" });
      return cleanup(mediaMessage(error));
    }
    clearTimers();
    acceptedHere.current = true;
    const res = await post(`/api/pulse/calls/${id}/respond`, { action: "accept" });
    const json = (await res.json().catch(() => null)) as { ice?: Ice; error?: string } | null;
    if (!res.ok) {
      stream.getTracks().forEach((t) => t.stop());
      return cleanup(json?.error ?? "This call is no longer available.");
    }
    ice.current = json?.ice ?? null;
    role.current = "callee";
    setState((s) => ({ ...s, phase: "connecting", localStream: stream }));
    timers.current.offer = setTimeout(() => {
      void post(`/api/pulse/calls/${id}/end`);
      cleanup("The call couldn't connect.");
    }, OFFER_TIMEOUT_MS);
  }, [state.phase, getMedia, cleanup]);

  const decline = useCallback(() => {
    if (callId.current) void post(`/api/pulse/calls/${callId.current}/respond`, { action: "decline" });
    cleanup();
  }, [cleanup]);

  const hangup = useCallback(() => {
    if (callId.current) void post(`/api/pulse/calls/${callId.current}/end`);
    cleanup();
  }, [cleanup]);

  // events from the other side, via the server
  useEffect(() => {
    return subscribe((event, payload) => {
      if (event === "call") {
        const type = payload.type as string;
        if (type === "incoming" && !callId.current) {
          const call = payload.call as { id: string; kind: CallKind };
          callId.current = call.id;
          role.current = "callee";
          kindRef.current = call.kind;
          setState({ ...IDLE, phase: "incoming", kind: call.kind, peer: (payload.from as PersonSummary) ?? null });
          timers.current.ring = setTimeout(() => cleanup(), INCOMING_TIMEOUT_MS);
        } else if (payload.callId !== callId.current) {
          return;
        } else if (type === "accepted" && role.current === "caller") {
          if (timers.current.ring) clearTimeout(timers.current.ring);
          setState((s) => ({ ...s, phase: "connecting" }));
          const peer = createPeer();
          void (async () => {
            try {
              const offer = await peer.createOffer();
              await peer.setLocalDescription(offer);
              send("offer", peer.localDescription?.toJSON());
            } catch {
              void post(`/api/pulse/calls/${callId.current}/end`);
              cleanup("The call couldn't connect.");
            }
          })();
        } else if (type === "handled" && !acceptedHere.current) {
          cleanup(); // answered on another tab or device
        } else if (type === "ended") {
          const status = payload.status as string;
          cleanup(status === "declined" ? "Call declined." : status === "missed" || status === "cancelled" ? (role.current === "caller" ? "No answer." : null) : null);
        }
      }
      if (event === "signal" && payload.callId === callId.current) {
        const kind = payload.kind as "offer" | "answer" | "candidate";
        void (async () => {
          try {
            if (kind === "offer" && role.current === "callee") {
              const peer = pc.current ?? createPeer();
              await peer.setRemoteDescription(payload.data as RTCSessionDescriptionInit);
              await flushCandidates();
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              send("answer", peer.localDescription?.toJSON());
            } else if (kind === "answer" && pc.current) {
              await pc.current.setRemoteDescription(payload.data as RTCSessionDescriptionInit);
              await flushCandidates();
            } else if (kind === "candidate") {
              if (pc.current?.remoteDescription) await pc.current.addIceCandidate(payload.data as RTCIceCandidateInit).catch(() => undefined);
              else pendingCandidates.current.push(payload.data as RTCIceCandidateInit);
            }
          } catch {
            void post(`/api/pulse/calls/${callId.current}/end`);
            cleanup("The call couldn't connect.");
          }
        })();
      }
    });
  }, [subscribe, cleanup, createPeer, flushCandidates, send]);

  // closing the tab hangs up, so the other person isn't left ringing or connected to nothing
  useEffect(() => {
    const onHide = () => {
      if (callId.current) void post(`/api/pulse/calls/${callId.current}/end`, undefined, true);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  useRingtone(state.phase === "incoming" || state.phase === "outgoing");

  const toggleMute = useCallback(() => {
    const next = !state.muted;
    local.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setState((s) => ({ ...s, muted: next }));
  }, [state.muted]);
  const toggleCamera = useCallback(() => {
    const next = !state.cameraOff;
    local.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
    setState((s) => ({ ...s, cameraOff: next }));
  }, [state.cameraOff]);
  const dismissNotice = useCallback(() => setState((s) => ({ ...s, notice: null })), []);

  const value = useMemo<Ctx>(() => ({ state, supported, startCall, accept, decline, hangup, toggleMute, toggleCamera, dismissNotice }), [state, supported, startCall, accept, decline, hangup, toggleMute, toggleCamera, dismissNotice]);
  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
