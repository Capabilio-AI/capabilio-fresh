"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export type MessagingEvent = "message" | "conversation" | "read" | "deleted";
type Listener = (event: MessagingEvent, payload: Record<string, unknown>) => void;
interface Summary { unread: number; requests: number }
interface Ctx extends Summary {
  /** Receive every live event; returns the unsubscribe. */
  subscribe: (fn: Listener) => () => void;
  refresh: () => void;
}

const MessagingContext = createContext<Ctx>({ unread: 0, requests: 0, subscribe: () => () => undefined, refresh: () => undefined });
export const useMessaging = () => useContext(MessagingContext);

const POLL_MS = 45_000;
const EVENTS: MessagingEvent[] = ["message", "conversation", "read", "deleted"];

/**
 * One live connection per tab, on the person's own private channel. Everything that wants messages (the inbox, the unread badge)
 * listens here. If the connection drops, a slow poll and a refresh on tab focus keep the badge honest.
 */
export function MessagingProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [summary, setSummary] = useState<Summary>({ unread: 0, requests: 0 });
  const listeners = useRef(new Set<Listener>());
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let live = true;
    fetch("/api/pulse/messages/summary")
      .then((r) => (r.ok ? (r.json() as Promise<Summary>) : Promise.reject(new Error("bad"))))
      .then((s) => live && setSummary(s))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [tick]);

  useEffect(() => {
    const client = createClient();
    let channel: ReturnType<typeof client.channel> | null = null;
    let cancelled = false;
    (async () => {
      const { data } = await client.auth.getSession();
      if (cancelled || !data.session) return;
      await client.realtime.setAuth(data.session.access_token);
      channel = client.channel(`user:${userId}`, { config: { private: true } });
      for (const event of EVENTS) {
        channel.on("broadcast", { event }, ({ payload }) => {
          listeners.current.forEach((fn) => fn(event, (payload ?? {}) as Record<string, unknown>));
          setTick((t) => t + 1);
        });
      }
      channel.subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void client.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    const poll = setInterval(() => document.visibilityState === "visible" && setTick((t) => t + 1), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && setTick((t) => t + 1);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const value = useMemo<Ctx>(
    () => ({ ...summary, refresh, subscribe: (fn) => (listeners.current.add(fn), () => void listeners.current.delete(fn)) }),
    [summary, refresh]
  );
  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}
