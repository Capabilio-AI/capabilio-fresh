import { describe, expect, it } from "vitest";
import { livekitConfig, mintCallToken, roomFor } from "./livekit";

const decode = (jwt: string) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());

describe("livekitConfig", () => {
  it("needs all three values and a websocket-style address", () => {
    expect(livekitConfig({})).toBeNull();
    expect(livekitConfig({ LIVEKIT_URL: "wss://x.livekit.cloud", LIVEKIT_API_KEY: "k" })).toBeNull();
    expect(livekitConfig({ LIVEKIT_URL: "not a url", LIVEKIT_API_KEY: "k", LIVEKIT_API_SECRET: "s" })).toBeNull();
  });
  it("accepts https and trailing slashes and gives a wss address", () => {
    expect(livekitConfig({ LIVEKIT_URL: "https://x.livekit.cloud/", LIVEKIT_API_KEY: "k", LIVEKIT_API_SECRET: "s" })).toEqual({ url: "wss://x.livekit.cloud", apiKey: "k", apiSecret: "s" });
  });
});

describe("mintCallToken", () => {
  it("is for one person in one call's room and expires", async () => {
    const jwt = await mintCallToken({ url: "wss://x", apiKey: "key", apiSecret: "secret-secret-secret-secret-secret" }, { callId: "abc", identity: "user-1", name: "Asha" });
    const claims = decode(jwt);
    expect(claims.sub).toBe("user-1");
    expect(claims.video).toMatchObject({ roomJoin: true, room: roomFor("abc"), canPublish: true, canSubscribe: true });
    expect(claims.exp - claims.nbf).toBeLessThanOrEqual(4 * 3600 + 5);
  });
});
