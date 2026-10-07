/**
 * ICE servers for calls. A call connects peer to peer when it can; behind a strict firewall or mobile network it needs a TURN relay.
 * Configure ONE of (server-only environment variables, never sent to the client except as the short-lived credentials below):
 *   - Cloudflare Calls TURN:  CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_KEY_API_TOKEN  (credentials are minted per call and expire)
 *   - Any static TURN (Metered, coturn, ...):  TURN_URLS (comma separated) + TURN_USERNAME + TURN_CREDENTIAL
 * With neither, calls use public STUN only and will fail for some people; the server logs a warning.
 */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}
export interface IceConfig {
  iceServers: IceServer[];
  /** a TURN relay is configured */
  relay: boolean;
}

const PUBLIC_STUN: IceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
const CREDENTIAL_TTL_SECONDS = 3600;

type Env = Record<string, string | undefined>;

/** Pure. The static-TURN configuration from the environment, or null when it is incomplete. */
export function staticIce(env: Env): IceConfig | null {
  const urls = (env.TURN_URLS ?? "").split(",").map((u) => u.trim()).filter((u) => /^turns?:/i.test(u));
  if (urls.length === 0 || !env.TURN_USERNAME || !env.TURN_CREDENTIAL) return null;
  return { iceServers: [...PUBLIC_STUN, { urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL }], relay: true };
}

let warned = false;

export async function loadIceConfig(env: Env = process.env, fetcher: typeof fetch = fetch): Promise<IceConfig> {
  if (env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_KEY_API_TOKEN) {
    try {
      const res = await fetcher(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_TURN_KEY_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: CREDENTIAL_TTL_SECONDS }),
      });
      if (res.ok) {
        const body = (await res.json()) as { iceServers?: IceServer[] };
        if (body.iceServers && body.iceServers.length > 0) return { iceServers: body.iceServers, relay: true };
      }
      console.error("[pulse-calls] Cloudflare TURN credential request failed:", res.status);
    } catch (error) {
      console.error("[pulse-calls] Cloudflare TURN credential request errored:", error instanceof Error ? error.message : error);
    }
  }
  const fixed = staticIce(env);
  if (fixed) return fixed;
  if (!warned) {
    warned = true;
    console.warn("[pulse-calls] No TURN relay configured: calls will use STUN only and fail on strict networks.");
  }
  return { iceServers: PUBLIC_STUN, relay: false };
}
