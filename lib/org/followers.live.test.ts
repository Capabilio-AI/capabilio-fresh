import { afterAll, describe, expect, it } from "vitest";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { browserFor } from "@/lib/test-support/live-http";
import { listOrgFollowers } from "./followers";

/**
 * Who follows a college page, against the real database (and the running app when LIVE_BASE_URL is set): newest first, paged without losing or repeating
 * anyone (including two people who followed at the same moment), blocked people left out, the viewer's own follow state, and who may open the list.
 * A throwaway college and people, all removed afterwards.
 */
const BASE = process.env.LIVE_BASE_URL;
const service = liveServiceClient();
const stamp = Date.now();
const users: string[] = [];
const colleges: string[] = [];
const T = (minute: number) => `2026-10-20T10:${String(minute).padStart(2, "0")}:00+00:00`;

const person = async (label: string, name: string) => {
  const login = await createThrowawayUserWithLogin(service, `fol-${label}`);
  users.push(login.userId);
  await service.from("profiles").update({ full_name: name }).eq("id", login.userId);
  return login;
};
const college = async (label: string, isPublic: boolean) => {
  const { data, error } = await service.from("institutions").insert({ name: `ZZ FOLLOWERS ${label} ${stamp}`, slug: `zz-fol-${label}-${stamp}` }).select("id, slug").single();
  if (error) throw error;
  colleges.push(data!.id);
  if (isPublic) {
    const { error: profileError } = await service.from("org_profiles" as never).insert({ institution_id: data!.id, is_public: true } as never);
    if (profileError) throw profileError;
  }
  return data!;
};
const follow = async (collegeId: string, userId: string, at: string) => {
  const { error } = await service.from("org_follows" as never).insert({ institution_id: collegeId, user_id: userId, followed_at: at } as never);
  if (error) throw error;
};
const join = async (collegeId: string, userId: string, role: string, branch: string | null, years?: { start: number; end: number }) => {
  const { data, error } = await service.from("institution_memberships").insert({ user_id: userId, institution_id: collegeId, role: role as never, branch, ...(years ? { start_year: years.start, end_year: years.end } : {}) }).select("id").single();
  if (error) throw error;
  await service.from("institution_memberships").update({ status: "active" }).eq("id", data!.id);
};

afterAll(async () => {
  for (const id of users) await deleteThrowawayUser(service, id);
  for (const id of colleges) {
    await service.from("org_follows" as never).delete().eq("institution_id", id);
    await service.from("org_profiles" as never).delete().eq("institution_id", id);
    await service.from("institution_memberships").delete().eq("institution_id", id);
    await service.from("institutions").delete().eq("id", id);
  }
});

describe("college followers list", () => {
  let publicCollege: { id: string; slug: string };
  let privateCollege: { id: string; slug: string };
  let viewer: { userId: string; email: string; password: string };
  let outsider: { userId: string; email: string; password: string };
  let privateMember: { userId: string; email: string; password: string };
  const names: Record<string, string> = {};
  const ids: Record<string, string> = {};
  /** Newest first; two people who followed at the same instant come in a fixed order, by id, newest id first. */
  const expectedOrder = () => {
    const tied = ["eve", "finn"].sort((a, b) => (ids[a] < ids[b] ? 1 : -1)).map((k) => names[k]);
    return ["Viewer Vi", ...tied, "Dev Fourth", "Cara Third", "Bob Second", "Ann Oldest"];
  };

  it("sets up a college with followers, a tie, a blocked follower, a student of the college and the viewer's own follow", async () => {
    publicCollege = await college("pub", true);
    privateCollege = await college("priv", false);
    viewer = await person("viewer", "Viewer Vi");
    outsider = await person("outsider", "Outsider Oz");
    privateMember = await person("pmember", "Private Pat");
    await join(privateCollege.id, privateMember.userId, "student", "CSE", { start: 2024, end: 2028 });

    // oldest to newest; "eve" and "finn" followed at the very same moment
    for (const [key, name, minute] of [["ann", "Ann Oldest", 1], ["bob", "Bob Second", 2], ["cara", "Cara Third", 3], ["dev", "Dev Fourth", 4], ["eve", "Eve Tied", 5], ["finn", "Finn Tied", 5]] as const) {
      const p = await person(key, name);
      names[key] = name;
      ids[key] = p.userId;
      await follow(publicCollege.id, p.userId, T(minute));
    }
    await join(publicCollege.id, ids.cara, "student", "ECE", { start: 2024, end: 2028 });
    const blocked = await person("blocked", "Blocked Bo");
    ids.blocked = blocked.userId;
    await follow(publicCollege.id, blocked.userId, T(6));
    await service.from("user_blocks" as never).insert({ blocker_id: viewer.userId, blocked_id: blocked.userId } as never);
    await service.from("follows" as never).insert({ follower_id: viewer.userId, followee_id: ids.bob } as never);
    await follow(publicCollege.id, viewer.userId, T(7));
  }, 120_000);

  it("lists the newest first and counts everyone who follows", async () => {
    const page = await listOrgFollowers(service, viewer.userId, publicCollege.id, null);
    expect(page.total).toBe(8); // six followers, the blocked one and the viewer
    expect(page.nextCursor).toBeNull();
    // newest first; the two who tied are in a fixed order; the blocked person is not shown
    expect(page.people.map((p) => p.name)).toEqual(expectedOrder());
  });

  it("pages through with no one lost or repeated, including the tie across a page boundary", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await listOrgFollowers(service, viewer.userId, publicCollege.id, cursor, 2);
      seen.push(...page.people.map((p) => p.name ?? "?"));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    // a page of 2 puts the viewer and the first of the tie on page 1 and the second of the tie on page 2: the tie straddles the boundary
    expect(seen).toEqual(expectedOrder());
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("says who is from this college, who the viewer follows, and which one is the viewer", async () => {
    const { people } = await listOrgFollowers(service, viewer.userId, publicCollege.id, null);
    const by = (name: string) => people.find((p) => p.name === name)!;
    expect(by("Cara Third")).toMatchObject({ fromThisCollege: true, following: false, isMe: false });
    expect(by("Ann Oldest")).toMatchObject({ fromThisCollege: false });
    expect(by("Bob Second")).toMatchObject({ following: true });
    expect(by("Viewer Vi")).toMatchObject({ isMe: true });
    expect(by("Cara Third").detail).toBe("ECE · Class of 2028");
  });

  it("hides a person the viewer blocked, and the blocked person's view hides the viewer", async () => {
    const { people } = await listOrgFollowers(service, viewer.userId, publicCollege.id, null);
    expect(people.some((p) => p.id === ids.blocked)).toBe(false);
    const theirs = await listOrgFollowers(service, ids.blocked, publicCollege.id, null);
    expect(theirs.people.some((p) => p.id === viewer.userId)).toBe(false);
  });

  it("never returns an email", async () => {
    const page = await listOrgFollowers(service, viewer.userId, publicCollege.id, null);
    expect(JSON.stringify(page)).not.toMatch(/@test\.capabilio\.invalid/);
  });

  describe.skipIf(!BASE)("through the running app", () => {
    it("refuses a visitor, and a bad cursor or unknown college", async () => {
      const visitor = await browserFor(BASE!);
      expect((await visitor("GET", `/api/orgs/followers?slug=${publicCollege.slug}`)).status).toBe(401);
      const asViewer = await browserFor(BASE!, viewer);
      expect((await asViewer("GET", `/api/orgs/followers?slug=${publicCollege.slug}&before=garbage`)).status).toBe(400);
      expect((await asViewer("GET", `/api/orgs/followers?slug=${publicCollege.slug}&before=${encodeURIComponent("2026-10-20T10:00:00Z|x),or(true")}`)).status).toBe(400);
      expect((await asViewer("GET", "/api/orgs/followers")).status).toBe(400);
      expect((await asViewer("GET", `/api/orgs/followers?slug=no-such-college-${stamp}`)).status).toBe(404);
    });

    it("gives a signed-in person the list of a public college", async () => {
      const asOutsider = await browserFor(BASE!, outsider);
      const res = await asOutsider("GET", `/api/orgs/followers?slug=${publicCollege.slug}`);
      expect(res.status).toBe(200);
      const body = res.json as { people: { name: string; isMe: boolean }[]; total: number };
      expect(body.total).toBe(8);
      expect(body.people.map((p) => p.name)).toContain("Cara Third");
      expect(body.people.some((p) => p.isMe)).toBe(false);
      expect(res.text).not.toMatch(/@test\.capabilio\.invalid/);
    });

    it("keeps a private college's followers to its own members", async () => {
      const asOutsider = await browserFor(BASE!, outsider);
      expect((await asOutsider("GET", `/api/orgs/followers?slug=${privateCollege.slug}`)).status).toBe(404);
      const asMember = await browserFor(BASE!, privateMember);
      expect((await asMember("GET", `/api/orgs/followers?slug=${privateCollege.slug}`)).status).toBe(200);
    });

    it("the college page offers the list to signed-in people and a sign-in link to visitors", async () => {
      const signedIn = await (await browserFor(BASE!, viewer))("GET", `/o/${publicCollege.slug}`);
      expect(signedIn.status).toBe(200);
      expect(signedIn.text).toMatch(/aria-haspopup="dialog"[^>]*>[^<]*(<!-- -->)?8(<!-- -->)? follower/);
      const visitor = await (await browserFor(BASE!))("GET", `/o/${publicCollege.slug}`);
      expect(visitor.status).toBe(200);
      expect(visitor.text).toMatch(/href="\/login"[^>]*>[^<]*(<!-- -->)?8(<!-- -->)? follower/);
    });
  });
});
