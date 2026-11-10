import { describe, expect, it, vi } from "vitest";
import { fetchPostings, marketKeys } from "./adzuna";

const keys = { appId: "id", appKey: "secret" };
const row = (i: number) => ({ id: i, title: `Job ${i}`, redirect_url: `https://a.io/${i}` });
const reply = (results: unknown[], ok = true, status = 200) => ({ ok, status, json: async () => ({ results }) }) as Response;

describe("marketKeys", () => {
  it("is null unless both keys are set", () => {
    expect(marketKeys({})).toBeNull();
    expect(marketKeys({ ADZUNA_APP_ID: "a" })).toBeNull();
    expect(marketKeys({ ADZUNA_APP_ID: "a", ADZUNA_APP_KEY: "b" })).toEqual({ appId: "a", appKey: "b" });
  });
});

describe("fetchPostings", () => {
  it("asks for Indian postings for the role and de-duplicates across pages", async () => {
    const full = Array.from({ length: 50 }, (_, i) => row(i));
    const f = vi.fn().mockResolvedValueOnce(reply(full)).mockResolvedValueOnce(reply([row(49), row(100)]));
    const out = await fetchPostings("Data Analyst", keys, { fetchImpl: f as unknown as typeof fetch });
    expect(out).toHaveLength(51);
    const first = String(f.mock.calls[0][0]);
    expect(first).toContain("/jobs/in/search/1");
    expect(first).toContain("what=Data+Analyst");
    expect(f).toHaveBeenCalledTimes(2); // the short second page ended it
  });
  it("fails without leaking the keys", async () => {
    const f = vi.fn().mockResolvedValue(reply([], false, 401));
    await expect(fetchPostings("x", keys, { fetchImpl: f as unknown as typeof fetch })).rejects.toThrow(/401/);
    await expect(fetchPostings("x", keys, { fetchImpl: f as unknown as typeof fetch })).rejects.not.toThrow(/secret/);
  });
});
