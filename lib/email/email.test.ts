import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./send";
import { staffInviteEmail } from "./invite-email";
import { MemberRoleSchema } from "@/lib/org/schemas";

const mail = { to: "a@b.edu", subject: "s", html: "<p>h</p>", text: "t" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendEmail", () => {
  it("sends nothing and says so when email is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await sendEmail(mail)).toEqual({ sent: false, reason: "not_configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports sent on a 2xx and failed on a rejection", async () => {
    vi.stubEnv("RESEND_API_KEY", "k");
    vi.stubEnv("EMAIL_FROM", "Capabilio <i@d.com>");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    expect(await sendEmail(mail)).toEqual({ sent: true });
    fetchSpy.mockResolvedValueOnce(new Response("bad domain", { status: 403 }));
    expect(await sendEmail(mail)).toEqual({ sent: false, reason: "failed" });
    fetchSpy.mockRejectedValueOnce(new Error("network"));
    expect(await sendEmail(mail)).toEqual({ sent: false, reason: "failed" });
  });
});

describe("staffInviteEmail", () => {
  it("escapes names and carries the link", () => {
    const m = staffInviteEmail({ to: "x@y.edu", institutionName: `A "B" <script>`, roleLabel: "Faculty", inviterName: "<b>Boss</b>", url: "https://app.test/invite/abc", expiresOn: "25 October 2026" });
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<b>Boss</b>");
    expect(m.html).toContain("https://app.test/invite/abc");
    expect(m.text).toContain("https://app.test/invite/abc");
  });
});

describe("MemberRoleSchema", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("accepts a staff role and rejects principal, student and extra keys", () => {
    expect(MemberRoleSchema.safeParse({ membershipId: id, role: "hod", permissions: null }).success).toBe(true);
    expect(MemberRoleSchema.safeParse({ membershipId: id, role: "principal", permissions: null }).success).toBe(false);
    expect(MemberRoleSchema.safeParse({ membershipId: id, role: "student", permissions: null }).success).toBe(false);
    expect(MemberRoleSchema.safeParse({ membershipId: id, role: "hod", permissions: null, status: "active" }).success).toBe(false);
  });
});
