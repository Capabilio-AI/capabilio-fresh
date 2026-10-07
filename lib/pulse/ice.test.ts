import { describe, expect, it } from "vitest";
import { loadIceConfig, staticIce } from "./ice";

describe("staticIce", () => {
  it("builds a relay config only when urls, username and credential are all present and are turn urls", () => {
    const cfg = staticIce({ TURN_URLS: "turn:a.example.com:3478, turns:a.example.com:443, https://nope", TURN_USERNAME: "u", TURN_CREDENTIAL: "p" });
    expect(cfg?.relay).toBe(true);
    expect(cfg?.iceServers.at(-1)).toEqual({ urls: ["turn:a.example.com:3478", "turns:a.example.com:443"], username: "u", credential: "p" });
    expect(staticIce({ TURN_URLS: "turn:a", TURN_USERNAME: "u" })).toBeNull();
    expect(staticIce({})).toBeNull();
  });
});

describe("loadIceConfig", () => {
  it("falls back to public STUN without a relay when nothing is configured", async () => {
    const cfg = await loadIceConfig({}, (async () => { throw new Error("must not be called"); }) as unknown as typeof fetch);
    expect(cfg.relay).toBe(false);
    expect(cfg.iceServers.length).toBeGreaterThan(0);
  });
  it("uses Cloudflare's minted credentials when configured", async () => {
    const fake = (async () => new Response(JSON.stringify({ iceServers: [{ urls: ["turn:x"], username: "tmp", credential: "tmp" }] }), { status: 200 })) as unknown as typeof fetch;
    const cfg = await loadIceConfig({ CLOUDFLARE_TURN_KEY_ID: "k", CLOUDFLARE_TURN_KEY_API_TOKEN: "t" }, fake);
    expect(cfg).toEqual({ iceServers: [{ urls: ["turn:x"], username: "tmp", credential: "tmp" }], relay: true });
  });
  it("falls back to static TURN when Cloudflare fails", async () => {
    const fake = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    const cfg = await loadIceConfig({ CLOUDFLARE_TURN_KEY_ID: "k", CLOUDFLARE_TURN_KEY_API_TOKEN: "t", TURN_URLS: "turn:s", TURN_USERNAME: "u", TURN_CREDENTIAL: "p" }, fake);
    expect(cfg.relay).toBe(true);
  });
});
