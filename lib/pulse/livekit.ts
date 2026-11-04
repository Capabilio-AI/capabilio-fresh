import { AccessToken } from "livekit-server-sdk";

/**
 * Calls run on LiveKit (a hosted media service): it connects people through firewalls and carries group calls. Configure, in the server environment:
 *   LIVEKIT_URL         e.g. wss://your-project.livekit.cloud
 *   LIVEKIT_API_KEY
 *   LIVEKIT_API_SECRET
 * The secret never leaves the server: the browser only receives a short-lived token for one call's room.
 */
export interface LiveKitConfig { url: string; apiKey: string; apiSecret: string }

type Env = Record<string, string | undefined>;

/** Pure. The configuration, or null when it is incomplete (calls are then reported as unavailable instead of failing mid-ring). */
export function livekitConfig(env: Env = process.env): LiveKitConfig | null {
  const raw = env.LIVEKIT_URL?.trim();
  const apiKey = env.LIVEKIT_API_KEY?.trim();
  const apiSecret = env.LIVEKIT_API_SECRET?.trim();
  if (!raw || !apiKey || !apiSecret) return null;
  const url = raw.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://").replace(/\/+$/, "");
  return /^wss?:\/\//i.test(url) ? { url, apiKey, apiSecret } : null;
}

/** One room per call, so a person can only ever be in the rooms of calls they were let into. */
export const roomFor = (callId: string): string => `call-${callId}`;

const TOKEN_TTL_SECONDS = 4 * 3600;

/** A token that lets one person join one call's room and publish audio and video. Identity is their user id, so they cannot join twice. */
export async function mintCallToken(config: LiveKitConfig, input: { callId: string; identity: string; name: string | null }): Promise<string> {
  const token = new AccessToken(config.apiKey, config.apiSecret, { identity: input.identity, name: input.name ?? undefined, ttl: TOKEN_TTL_SECONDS });
  token.addGrant({ roomJoin: true, room: roomFor(input.callId), canPublish: true, canSubscribe: true, canPublishData: true });
  return token.toJwt();
}
