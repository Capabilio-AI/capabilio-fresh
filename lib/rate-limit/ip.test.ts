import { describe, expect, it } from "vitest";
import { clientIp, ipRateLimitKey } from "./ip";

const req = (ip?: string) => new Request("http://x", { headers: ip ? { "x-forwarded-for": ip } : {} });

describe("ipRateLimitKey", () => {
  it("is a stable uuid-shaped key per IP", () => {
    const k = ipRateLimitKey(req("1.2.3.4, 5.6.7.8"));
    expect(k).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(ipRateLimitKey(req("1.2.3.4"))).toBe(k);
    expect(ipRateLimitKey(req("9.9.9.9"))).not.toBe(k);
    expect(ipRateLimitKey(req())).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("clientIp", () => {
  const withHeaders = (h: Record<string, string>) => new Request("http://x", { headers: h });
  it("prefers the edge-set x-real-ip over a client-supplied x-forwarded-for", () => {
    expect(clientIp(withHeaders({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "6.6.6.6" }))).toBe("1.1.1.1");
    expect(clientIp(withHeaders({ "x-vercel-forwarded-for": "2.2.2.2", "x-forwarded-for": "6.6.6.6" }))).toBe("2.2.2.2");
  });
  it("falls back to the first x-forwarded-for entry, then 'unknown'", () => {
    expect(clientIp(withHeaders({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" }))).toBe("3.3.3.3");
    expect(clientIp(withHeaders({}))).toBe("unknown");
  });
});
