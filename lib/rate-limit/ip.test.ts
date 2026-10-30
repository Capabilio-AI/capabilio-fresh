import { describe, expect, it } from "vitest";
import { ipRateLimitKey } from "./ip";

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
