"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ConnectionState, Room, RoomEvent, Track, type Participant } from "livekit-client";
import type { CallKind } from "@/lib/pulse/call-rules";
import { RING_SECONDS } from "@/lib/pulse/call-rules";
import type { PersonSummary } from "@/lib/pulse/people";
import { useMessaging } from "./MessagingProvider";

export type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "active";
/** One person's tile in the call: their camera when it is on, otherwise their picture. */
export interface CallTile {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  isLocal: boolean;
  speaking: boolean;
  micOn: boolean;
  /** their camera track, when it is on (attach it to a video element) */
  video: Track | null;
}
export interface RingingPerson { id: string; name: string | null; avatarUrl: string | null }
export interface CallState {
  phase: CallPhase;
  kind: CallKind;
  /** the person who rang you, or the person you rang */
  peer: PersonSummary | null;
  /** someone was added: more than two people are (or were) in this call */
  group: boolean;
  muted: boolean;
  cameraOff: boolean;
  /** when the call connected, for the timer */
  startedAt: number | null;
  tiles: CallTile[];
  /** people added to the call who have not answered yet */
  ringing: RingingPerson[];
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
  /** add people to the call in progress; resolves to a message when some could not be added, or null */
  invite: (userIds: string[]) => Promise<string | null>;
  dismissNotice: () => void;
}

const IDLE: CallState = { phase: "idle", kind: "voice", peer: null, group: false, muted: false, cameraOff: false, startedAt: null, tiles: [], ringing: [], notice: null };
const CallContext = createContext<Ctx | null>(null);
export function useCall(): Ctx {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

const INCOMING_TIMEOUT_MS = (RING_SECONDS + 5) * 1000;
const CONNECT_TIMEOUT_MS = 25_000;

const post = (url: string, body?: unknown, keepalive = false) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), keepalive });

function mediaMessage(error: unknown): string {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "Allow microphone and camera access in your browser to make calls.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone or camera was found on this device.";
  if (name === "NotReadableError") return "Your microphone or camera is being used by another app.";
  return "Couldn't access your microphone or camera.";
}

/** Asks for the microphone (and camera) now, so a refusal is reported before anyone's phone rings. The tracks are released straight away. */
async function probeMedia(kind: CallKind): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
  stream.getTracks().forEach((t) => t.stop());
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
 * Voice and video calls, one to one or in a group. The server decides who may be in a call and hands each person a short-lived token; the
 * audio and video themselves run through LiveKit, which connects people through firewalls and carries a whole group. Ringing, answering and
 * adding people go through the server and each person's private channel.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { subscribe } = useMessaging();
  const [state, setState] = useState<CallState>(IDLE);
  const [supported] = useState(() => typeof window !== "undefined" && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia));

  const callId = useRef<string | null>(null);
  const role = useRef<"caller" | "callee" | null>(null);
  const kindRef = useRef<CallKind>("voice");
  const room = useRef<Room | null>(null);
  const audioEls = useRef<HTMLMediaElement[]>([]);
  const people = useRef(new Map<string, { name: string | null; avatarUrl: string | null }>());
  const timers = useRef<{ ring?: ReturnType<typeof setTimeout>; connect?: ReturnType<typeof setTimeout> }>({});
  const acceptedHere = useRef(false);

  const clearTimers = () => {
    for (const t of Object.values(timers.current)) if (t) clearTimeout(t);
    timers.current = {};
  };

  const cleanup = useCallback((notice: string | null = null) => {
    clearTimers();
    audioEls.current.forEach((el) => el.remove());
    audioEls.current = [];
    const r = room.current;
    room.current = null;
    if (r) void r.disconnect().catch(() => undefined);
    callId.current = null;
    role.current = null;
    acceptedHere.current = false;
    people.current.clear();
    setState({ ...IDLE, notice });
  }, []);

  /** Rebuilds the tiles from who is in the room right now. */
  const rebuild = useCallback(() => {
    const r = room.current;
    if (!r) return;
    const tile = (p: Participant, isLocal: boolean): CallTile => {
      const known = people.current.get(p.identity);
      const cam = p.getTrackPublication(Track.Source.Camera);
      return { id: p.identity, name: p.name || known?.name || null, avatarUrl: known?.avatarUrl ?? null, isLocal, speaking: p.isSpeaking, micOn: p.isMicrophoneEnabled, video: cam?.track && !cam.isMuted ? cam.track : null };
    };
    const tiles = [tile(r.localParticipant, true), ...[...r.remoteParticipants.values()].map((p) => tile(p, false))];
    setState((s) => ({ ...s, tiles, muted: !r.localParticipant.isMicrophoneEnabled, cameraOff: !r.localParticipant.isCameraEnabled, group: s.group || tiles.length > 2 }));
  }, []);

  /** Joins the call's room with a token from the server and starts the microphone (and camera for a video call). */
  const connect = useCallback(async (id: string) => {
    setState((s) => ({ ...s, phase: "connecting" }));
    timers.current.connect = setTimeout(() => {
      void post(`/api/pulse/calls/${id}/end`);
      cleanup("The call couldn't connect. Check your connection and try again.");
    }, CONNECT_TIMEOUT_MS);
    try {
      const res = await post(`/api/pulse/calls/${id}/token`);
      const json = (await res.json().catch(() => null)) as { token?: string; url?: string; error?: string } | null;
      if (!res.ok || !json?.token || !json.url) {
        void post(`/api/pulse/calls/${id}/end`);
        return cleanup(json?.error ?? "The call couldn't connect.");
      }
      const r = new Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      room.current = r;
      r.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.style.display = "none";
          document.body.appendChild(el);
          audioEls.current.push(el);
        }
        rebuild();
      });
      r.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => { el.remove(); audioEls.current = audioEls.current.filter((x) => x !== el); });
        rebuild();
      });
      for (const e of [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.ActiveSpeakersChanged]) r.on(e, rebuild);
      r.on(RoomEvent.AudioPlaybackStatusChanged, () => { if (!r.canPlaybackAudio) void r.startAudio().catch(() => undefined); });
      r.on(RoomEvent.Disconnected, () => {
        if (room.current !== r) return; // we ended it ourselves
        void post(`/api/pulse/calls/${id}/end`);
        cleanup("The call dropped.");
      });
      await r.connect(json.url, json.token);
      if (r.state !== ConnectionState.Connected) throw new Error("not connected");
      await r.localParticipant.setMicrophoneEnabled(true);
      if (kindRef.current === "video") await r.localParticipant.setCameraEnabled(true);
      await r.startAudio().catch(() => undefined);
      clearTimeout(timers.current.connect);
      setState((s) => ({ ...s, phase: "active", startedAt: Date.now() }));
      rebuild();
    } catch (error) {
      void post(`/api/pulse/calls/${id}/end`);
      cleanup(["NotAllowedError", "NotFoundError", "NotReadableError", "SecurityError"].includes((error as { name?: string })?.name ?? "") ? mediaMessage(error) : "The call couldn't connect. Check your connection and try again.");
    }
  }, [cleanup, rebuild]);

  const startCall = useCallback(async (peer: PersonSummary, kind: CallKind) => {
    if (state.phase !== "idle" || !supported) return;
    try {
      await probeMedia(kind);
    } catch (error) {
      return setState({ ...IDLE, notice: mediaMessage(error) });
    }
    try {
      const res = await post("/api/pulse/calls", { userId: peer.id, kind });
      const json = (await res.json().catch(() => null)) as { call?: { id: string }; error?: string } | null;
      if (!res.ok || !json?.call) return setState({ ...IDLE, notice: json?.error ?? "Couldn't start the call." });
      callId.current = json.call.id;
      role.current = "caller";
      kindRef.current = kind;
      people.current.set(peer.id, { name: peer.name, avatarUrl: peer.avatarUrl });
      setState({ ...IDLE, phase: "outgoing", kind, peer });
      timers.current.ring = setTimeout(() => {
        if (callId.current) void post(`/api/pulse/calls/${callId.current}/end`);
        cleanup("No answer.");
      }, RING_SECONDS * 1000);
    } catch {
      setState({ ...IDLE, notice: "Couldn't reach the server." });
    }
  }, [state.phase, supported, cleanup]);

  const accept = useCallback(async () => {
    if (state.phase !== "incoming" || !callId.current) return;
    const id = callId.current;
    try {
      await probeMedia(kindRef.current);
    } catch (error) {
      void post(`/api/pulse/calls/${id}/respond`, { action: "decline" });
      return cleanup(mediaMessage(error));
    }
    clearTimers();
    acceptedHere.current = true;
    const res = await post(`/api/pulse/calls/${id}/respond`, { action: "accept" });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      return cleanup(json?.error ?? "This call is no longer available.");
    }
    role.current = "callee";
    await connect(id);
  }, [state.phase, cleanup, connect]);

  const decline = useCallback(() => {
    if (callId.current) void post(`/api/pulse/calls/${callId.current}/respond`, { action: "decline" });
    cleanup();
  }, [cleanup]);

  const hangup = useCallback(() => {
    if (callId.current) void post(`/api/pulse/calls/${callId.current}/end`);
    cleanup();
  }, [cleanup]);

  const invite = useCallback(async (userIds: string[]): Promise<string | null> => {
    if (!callId.current || userIds.length === 0) return null;
    try {
      const res = await post(`/api/pulse/calls/${callId.current}/invite`, { userIds });
      const json = (await res.json().catch(() => null)) as { invited?: string[]; skipped?: { message: string }[]; error?: string } | null;
      if (!res.ok) return json?.error ?? "Couldn't add them.";
      if (json?.invited?.length) setState((s) => ({ ...s, group: true }));
      return json?.skipped?.length ? json.skipped[0].message : null;
    } catch {
      return "Couldn't reach the server.";
    }
  }, []);

  // events from the server: someone rings you, answers, is added, or the call ends
  useEffect(() => {
    return subscribe((event, payload) => {
      if (event !== "call") return;
      const type = payload.type as string;
      if (type === "incoming" && !callId.current) {
        const call = payload.call as { id: string; kind: CallKind };
        callId.current = call.id;
        role.current = "callee";
        kindRef.current = call.kind;
        const from = (payload.from as PersonSummary) ?? null;
        if (from) people.current.set(from.id, { name: from.name, avatarUrl: from.avatarUrl });
        setState({ ...IDLE, phase: "incoming", kind: call.kind, peer: from, group: Boolean(payload.group) });
        timers.current.ring = setTimeout(() => cleanup(), INCOMING_TIMEOUT_MS);
        return;
      }
      if (payload.callId !== callId.current) return;
      if (type === "accepted" && role.current === "caller") {
        if (timers.current.ring) clearTimeout(timers.current.ring);
        void connect(callId.current as string);
      } else if (type === "handled" && !acceptedHere.current) {
        cleanup(); // answered on another tab or device
      } else if (type === "participants") {
        const list = payload.participants as { id: string; status: string; name: string | null; avatarUrl: string | null }[];
        list.forEach((p) => people.current.set(p.id, { name: p.name, avatarUrl: p.avatarUrl }));
        setState((s) => ({ ...s, ringing: list.filter((p) => p.status === "ringing").map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl })) }));
        rebuild();
      } else if (type === "ended") {
        const status = payload.status as string;
        cleanup(status === "declined" ? "Call declined." : status === "missed" || status === "cancelled" ? (role.current === "caller" ? "No answer." : null) : null);
      }
    });
  }, [subscribe, cleanup, connect, rebuild]);

  // closing the tab hangs up, so nobody is left ringing or talking to an empty room
  useEffect(() => {
    const onHide = () => {
      if (callId.current) void post(`/api/pulse/calls/${callId.current}/end`, undefined, true);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  useRingtone(state.phase === "incoming" || state.phase === "outgoing");

  const toggleMute = useCallback(() => {
    const lp = room.current?.localParticipant;
    if (lp) void lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled).then(rebuild).catch(() => undefined);
  }, [rebuild]);
  const toggleCamera = useCallback(() => {
    const lp = room.current?.localParticipant;
    if (lp) void lp.setCameraEnabled(!lp.isCameraEnabled).then(rebuild).catch((error) => setState((s) => ({ ...s, notice: mediaMessage(error) })));
  }, [rebuild]);
  const dismissNotice = useCallback(() => setState((s) => ({ ...s, notice: null })), []);

  const value = useMemo<Ctx>(() => ({ state, supported, startCall, accept, decline, hangup, toggleMute, toggleCamera, invite, dismissNotice }), [state, supported, startCall, accept, decline, hangup, toggleMute, toggleCamera, invite, dismissNotice]);
  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
