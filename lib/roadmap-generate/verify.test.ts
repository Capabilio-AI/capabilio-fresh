import { describe, expect, it, vi } from "vitest";
import { distinctiveWords, isPrivateAddress, isSafePublicUrl, pageMentionsCertification, safeFetch, verifyCertification } from "./verify";

const publicDns = async () => ["93.184.216.34"];
const html = (body: string, status = 200, type = "text/html; charset=utf-8") => new Response(body, { status, headers: { "content-type": type } });

describe("isPrivateAddress", () => {
  it("flags loopback, private, link-local and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.4.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700::1"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
});

describe("isSafePublicUrl", () => {
  it("accepts a public https host and rejects everything else", async () => {
    expect(await isSafePublicUrl("https://example.com/cert", publicDns)).toBe(true);
    expect(await isSafePublicUrl("http://example.com", publicDns)).toBe(false);
    expect(await isSafePublicUrl("https://user:pw@example.com", publicDns)).toBe(false);
    expect(await isSafePublicUrl("https://example.com:8443", publicDns)).toBe(false);
    expect(await isSafePublicUrl("https://localhost/x", publicDns)).toBe(false);
    expect(await isSafePublicUrl("https://169.254.169.254/latest", publicDns)).toBe(false);
    expect(await isSafePublicUrl("https://metadata.internal/", publicDns)).toBe(false);
    expect(await isSafePublicUrl("https://sneaky.example.com", async () => ["10.0.0.9"])).toBe(false);
    expect(await isSafePublicUrl("https://nxdomain.example", async () => { throw new Error("ENOTFOUND"); })).toBe(false);
    expect(await isSafePublicUrl("not a url", publicDns)).toBe(false);
  });
});

describe("pageMentionsCertification", () => {
  it("needs the certification to be named on the page", () => {
    expect(pageMentionsCertification("<h1>AWS Certified Solutions Architect - Associate</h1>", "AWS Certified Solutions Architect Associate", "Amazon Web Services")).toBe(true);
    expect(pageMentionsCertification("<h1>Solutions Architect exam guide</h1>", "AWS Certified Solutions Architect Associate", "Amazon Web Services")).toBe(true);
    expect(pageMentionsCertification("<h1>Welcome to our homepage</h1><p>Cooking recipes</p>", "AWS Certified Solutions Architect Associate", "Amazon Web Services")).toBe(false);
  });
  it("drops provider and generic words from the name", () => {
    expect(distinctiveWords("Google Data Analytics Professional Certificate", "Google")).toEqual(["data", "analytics"]);
  });
});

describe("safeFetch / verifyCertification", () => {
  it("follows a safe redirect but refuses one that points at a private host", async () => {
    const ok = vi.fn().mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/final" } })).mockResolvedValueOnce(html("AWS Certified Cloud Practitioner"));
    expect((await safeFetch("https://example.com/a", { fetchImpl: ok, resolve: publicDns }))?.status).toBe(200);
    const evil = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } }));
    expect(await safeFetch("https://example.com/a", { fetchImpl: evil, resolve: publicDns })).toBeNull();
  });
  it("accepts a real certification page and rejects a 404, a non-HTML file or an unrelated page", async () => {
    const c = { name: "AWS Certified Cloud Practitioner", provider: "Amazon Web Services", url: "https://aws.amazon.com/certification/cloud-practitioner/" };
    expect(await verifyCertification(c, { fetchImpl: vi.fn().mockResolvedValue(html("<title>AWS Certified Cloud Practitioner</title>")), resolve: publicDns })).toBe(true);
    expect(await verifyCertification(c, { fetchImpl: vi.fn().mockResolvedValue(html("not found", 404)), resolve: publicDns })).toBe(false);
    expect(await verifyCertification(c, { fetchImpl: vi.fn().mockResolvedValue(html("%PDF", 200, "application/pdf")), resolve: publicDns })).toBe(false);
    expect(await verifyCertification(c, { fetchImpl: vi.fn().mockResolvedValue(html("<h1>Welcome home</h1>")), resolve: publicDns })).toBe(false);
  });
});
