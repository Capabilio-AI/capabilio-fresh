import { describe, expect, it } from "vitest";
import { sniffImage, ownsMedia } from "./media";
import { groupStories, sortGroups, type StoryGroup } from "./stories";
import type { PersonSummary } from "./people";

const person = (id: string): PersonSummary => ({ id, name: id, avatarUrl: null, headline: null, role: "student" });
const people = new Map(["me", "ann", "bob"].map((id) => [id, person(id)]));
const now = new Date("2026-10-07T12:00:00Z").getTime();
const row = (id: string, user: string, createdAt: string, expiresAt = "2026-10-08T12:00:00Z") => ({ id, user_id: user, kind: "text" as const, body: "hi", image_path: null, theme: 0, created_at: createdAt, expires_at: expiresAt });

describe("groupStories", () => {
  it("groups by author, marks viewed, drops expired, and treats your own as seen", () => {
    const groups = groupStories(
      [row("1", "ann", "2026-10-07T08:00:00Z"), row("2", "ann", "2026-10-07T09:00:00Z"), row("3", "bob", "2026-10-07T07:00:00Z", "2026-10-07T11:00:00Z"), row("4", "me", "2026-10-07T06:00:00Z")],
      new Set(["1"]), people, "me", new Map(), now
    );
    expect(groups.map((g) => g.user.id)).toEqual(["me", "ann"]); // bob's only story expired
    const ann = groups[1];
    expect(ann.stories.map((s) => [s.id, s.viewed])).toEqual([["1", true], ["2", false]]);
    expect(ann.hasUnviewed).toBe(true);
    expect(groups[0].hasUnviewed).toBe(false);
  });
});

describe("sortGroups", () => {
  const g = (id: string, isMe: boolean, hasUnviewed: boolean, at: string): StoryGroup => ({ user: person(id), isMe, hasUnviewed, stories: [{ id, kind: "text", body: "x", imageUrl: null, theme: 0, createdAt: at, expiresAt: "", viewed: !hasUnviewed }] });
  it("puts you first, then unseen, then newest", () => {
    const out = sortGroups([g("old-seen", false, false, "2026-10-07T01:00:00Z"), g("new-seen", false, false, "2026-10-07T05:00:00Z"), g("unseen", false, true, "2026-10-07T00:00:00Z"), g("me", true, false, "2026-10-06T00:00:00Z")]);
    expect(out.map((x) => x.user.id)).toEqual(["me", "unseen", "new-seen", "old-seen"]);
  });
});

describe("media safety", () => {
  it("identifies images by their bytes, not their name", () => {
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("image/png");
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("lets you attach only your own uploads, for the right purpose", () => {
    expect(ownsMedia("u1", "story", "u1/story/a.png")).toBe(true);
    expect(ownsMedia("u1", "story", "u2/story/a.png")).toBe(false);
    expect(ownsMedia("u1", "story", "u1/post/a.png")).toBe(false);
    expect(ownsMedia("u1", "story", "u1/story/../../u2/story/a.png")).toBe(false);
  });
});
