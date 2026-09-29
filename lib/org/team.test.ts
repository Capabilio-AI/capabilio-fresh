import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_PERMISSION_KEYS, effectivePermissions } from "./roles";
import { checkGrant, grantablePermissions, hashToken, inviteUrl, isInvitationUsable, joinUrl, newInviteToken, newJoinCode } from "./team";
import { AcceptInviteSchema, InviteSchema, JoinLinkSchema, MemberPermissionsSchema, PostSchema, ProfileSchema } from "./schemas";
import { MAX_MEDIA_BYTES, mediaPath, ownPathFromPublicUrl, sniffDocument, sniffImage } from "./media";
import { initialsOf, timeAgo } from "./format";
import { placementsToCsv } from "./outcomes";

const admin = { kind: "admin" as const, permissions: effectivePermissions("principal", null) };
const faculty = { kind: "staff" as const, permissions: effectivePermissions("faculty", null) };
const withMembers = { kind: "staff" as const, permissions: effectivePermissions("faculty", ["students", "classroom", "members"]) };

describe("invitation tokens", () => {
  it("are long, unique and stored only as a hash", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a.token.length).toBeGreaterThanOrEqual(40);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(hashToken(a.token));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).not.toContain(a.token);
  });
  it("join codes match the table constraint", () => {
    for (let i = 0; i < 50; i++) expect(newJoinCode()).toMatch(/^[a-z0-9]{8,32}$/);
  });
  it("builds absolute links", () => {
    expect(inviteUrl("https://x.io", "abc")).toBe("https://x.io/invite/abc");
    expect(joinUrl("https://x.io", "abcd1234")).toBe("https://x.io/join/abcd1234");
  });
  it("an invitation is usable only if unused, not cancelled and unexpired", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const base = { accepted_at: null, revoked_at: null, expires_at: "2026-10-05T00:00:00Z" };
    expect(isInvitationUsable(base, now)).toBe(true);
    expect(isInvitationUsable({ ...base, accepted_at: "2026-09-30T00:00:00Z" }, now)).toBe(false);
    expect(isInvitationUsable({ ...base, revoked_at: "2026-09-30T00:00:00Z" }, now)).toBe(false);
    expect(isInvitationUsable({ ...base, expires_at: "2026-09-30T00:00:00Z" }, now)).toBe(false);
    expect(isInvitationUsable(null, now)).toBe(false);
  });
});

describe("an invitation can never escalate privilege", () => {
  it("admins can grant anything, including full access", () => {
    expect(grantablePermissions(admin).size).toBe(ALL_PERMISSION_KEYS.length);
    expect(checkGrant(admin, "vice_principal", null)).toEqual({ ok: true });
    expect(checkGrant(admin, "faculty", ["members", "curriculum"])).toEqual({ ok: true });
  });
  it("a non-admin cannot mint admins or hand out Team & access", () => {
    expect(checkGrant(withMembers, "vice_principal", null).ok).toBe(false);
    expect(checkGrant(withMembers, "faculty", ["members"]).ok).toBe(false);
    expect(grantablePermissions(withMembers).has("members")).toBe(false);
  });
  it("a non-admin can only pass on what they hold", () => {
    expect(checkGrant(withMembers, "faculty", ["students", "classroom"])).toEqual({ ok: true });
    expect(checkGrant(withMembers, "faculty", ["placements"]).ok).toBe(false);
    expect(checkGrant(withMembers, "tpo", null).ok).toBe(false); // tpo defaults include placements/outcomes they don't hold
    expect(checkGrant(faculty, "faculty", null)).toEqual({ ok: true });
  });
});

describe("team request bodies are strict", () => {
  const uuid = "33333333-3333-4333-8333-333333333333";
  it("invite: only a fixed role list, a valid email, known permissions, nothing else", () => {
    expect(InviteSchema.safeParse({ email: " Staff@College.EDU ", role: "faculty" }).data?.email).toBe("staff@college.edu");
    expect(InviteSchema.safeParse({ email: "a@b.co", role: "principal" }).success).toBe(false);
    expect(InviteSchema.safeParse({ email: "a@b.co", role: "student" }).success).toBe(false);
    expect(InviteSchema.safeParse({ email: "not-an-email", role: "faculty" }).success).toBe(false);
    expect(InviteSchema.safeParse({ email: "a@b.co", role: "faculty", permissions: ["hack"] }).success).toBe(false);
    expect(InviteSchema.safeParse({ email: "a@b.co", role: "faculty", permissions: ["chat"], institutionId: uuid }).success).toBe(false);
    expect(InviteSchema.safeParse({ email: "a@b.co", role: "faculty", permissions: null }).success).toBe(true);
  });
  it("accept: name + password + token only — no role, permissions or institution", () => {
    const ok = { token: "x".repeat(43), fullName: "Asha Rao", password: "longenough" };
    expect(AcceptInviteSchema.safeParse(ok).success).toBe(true);
    for (const extra of [{ role: "principal" }, { permissions: ["members"] }, { institutionId: uuid }, { email: "a@b.co" }]) expect(AcceptInviteSchema.safeParse({ ...ok, ...extra }).success).toBe(false);
    expect(AcceptInviteSchema.safeParse({ ...ok, password: "short" }).success).toBe(false);
  });
  it("permissions / join link / profile bodies reject smuggled fields", () => {
    expect(MemberPermissionsSchema.safeParse({ membershipId: uuid, permissions: ["chat"] }).success).toBe(true);
    expect(MemberPermissionsSchema.safeParse({ membershipId: uuid, permissions: ["chat"], role: "principal" }).success).toBe(false);
    expect(JoinLinkSchema.safeParse({ label: "CSE", endYear: 2027, institutionId: uuid }).success).toBe(false);
    expect(ProfileSchema.safeParse({ isPublic: true, logoUrl: "https://evil.example/x.png" }).success).toBe(false);
    expect(ProfileSchema.safeParse({ isPublic: true, coverImageUrl: "https://evil.example/x.png" }).success).toBe(false);
    expect(ProfileSchema.safeParse({ isPublic: true, tagline: "x".repeat(161) }).success).toBe(false);
  });
  it("a post needs only text; an event also needs a start", () => {
    expect(PostSchema.safeParse({ type: "announcement", body: "Hello students" }).success).toBe(true);
    expect(PostSchema.safeParse({ type: "event", body: "Talk" }).success).toBe(false);
    expect(PostSchema.safeParse({ type: "announcement", body: "" }).success).toBe(false);
  });
});

describe("uploads are checked by their bytes, scoped to the college", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
  const pdf = new Uint8Array(Buffer.from("%PDF-1.7 rest"));
  it("recognises png/jpeg/webp and rejects everything else, whatever the filename claims", () => {
    expect(sniffImage(png)?.contentType).toBe("image/png");
    expect(sniffImage(jpg)?.ext).toBe("jpg");
    expect(sniffImage(webp)?.contentType).toBe("image/webp");
    expect(sniffImage(new Uint8Array(Buffer.from("<svg onload=alert(1)>")))).toBeNull();
    expect(sniffImage(new Uint8Array(Buffer.from("GIF89a....")))).toBeNull();
    expect(sniffImage(pdf)).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
  it("offer letters accept a PDF or an image, nothing executable", () => {
    expect(sniffDocument(pdf)?.contentType).toBe("application/pdf");
    expect(sniffDocument(png)?.ext).toBe("png");
    expect(sniffDocument(new Uint8Array(Buffer.from("MZ\x90\x00")))).toBeNull();
  });
  it("paths are institution-scoped and traversal is rejected when recovering an own path", () => {
    expect(mediaPath("inst-1", "logo", "png", "abc")).toBe("inst-1/logo-abc.png");
    const base = "https://p.supabase.co/storage/v1/object/public/org-media/";
    expect(ownPathFromPublicUrl(`${base}inst-1/logo-abc.png`, "org-media", "inst-1")).toBe("inst-1/logo-abc.png");
    expect(ownPathFromPublicUrl(`${base}inst-2/logo-abc.png`, "org-media", "inst-1")).toBeNull();
    expect(ownPathFromPublicUrl(`${base}inst-1/../inst-2/x.png`, "org-media", "inst-1")).toBeNull();
    expect(ownPathFromPublicUrl("https://evil.example/a.png", "org-media", "inst-1")).toBeNull();
    expect(ownPathFromPublicUrl(null, "org-media", "inst-1")).toBeNull();
    expect(MAX_MEDIA_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("formatting helpers", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("relative time reads like a feed", () => {
    expect(timeAgo("2026-10-10T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-10-10T11:15:00Z", now)).toBe("45m");
    expect(timeAgo("2026-10-10T07:00:00Z", now)).toBe("5h");
    expect(timeAgo("2026-10-07T12:00:00Z", now)).toBe("3d");
    expect(timeAgo("2026-09-26T12:00:00Z", now)).toBe("2w");
    expect(timeAgo(null, now)).toBe("");
  });
  it("initials skip symbols and cap at two", () => {
    expect(initialsOf("Visual QA Institute of Technology")).toBe("VQ");
    expect(initialsOf("(St.) Mary's")).toBe("SM");
    expect(initialsOf("123")).toBe("•");
  });
});

describe("migrations 043-045 keep every new table private and the storage rules tight", () => {
  const sql = ["043_org_access_invites_media", "044_org_company_visits", "045_org_team_chat"].map((f) => readFileSync(`supabase/migrations/${f}.sql`, "utf8")).join("\n");
  it("no client policy or grant on the new tables", () => {
    for (const t of ["org_invitations", "org_join_links", "org_join_link_uses", "org_chat_channels", "org_chat_channel_members", "org_chat_messages", "org_chat_reads"]) expect(sql, t).toContain(`'${t}'`);
    expect(sql).toMatch(/revoke all on public\.%I from anon, authenticated/);
    expect(sql).not.toMatch(/create policy \w+ on public\.org_(invitations|join|chat)/);
  });
  it("invitations store only a token hash, and never allow the principal role", () => {
    expect(sql).toMatch(/token_hash text not null unique/);
    expect(sql).not.toMatch(/\btoken text\b/);
    expect(sql).toMatch(/role in \('faculty', 'hod', 'tpo', 'vice_principal'\)/);
  });
  it("offer letters live in a PRIVATE bucket and college pictures in a size/type-limited public one", () => {
    expect(sql).toMatch(/'org-offers', 'org-offers', false/);
    expect(sql).toMatch(/'org-media', 'org-media', true, 5242880, array\['image\/png', 'image\/jpeg', 'image\/webp'\]/);
  });
  it("the join-link attribution can never fail a signup", () => {
    expect(sql).toMatch(/exception when others then\s+null;/);
  });
});

describe("csv export stays safe with the new columns", () => {
  it("still neutralises formulas", () => {
    const csv = placementsToCsv([{ id: "1", studentUserId: "u", studentName: "=cmd|' /C calc'!A0", branch: "CSE", company: "Co", roleTitle: "SWE", ctcLpa: 5, offerDate: null, confirmedAt: "2026-09-01T00:00:00Z", showOnWall: false, opportunityId: null, studentResponse: "pending", hasLetter: true }]);
    expect(csv.split("\n")[1].startsWith("'=cmd")).toBe(true);
  });
});
