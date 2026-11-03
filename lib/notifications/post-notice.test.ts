import { describe, expect, it } from "vitest";
import { postNotice } from "./post-notice";

const post = (type: string) => ({ id: "p1", type, title: "Hello" });

describe("postNotice", () => {
  it("keeps the college wording and link exactly as before", () => {
    expect(postNotice({ company: false, name: "NIT", slug: "nit" }, post("event"))).toEqual({ type: "post_event", title: "NIT: new event", href: "/o/nit/posts/p1" });
    expect(postNotice({ company: false, name: "NIT", slug: "nit" }, post("announcement"))).toEqual({ type: "post_announcement", title: "NIT: new announcement", href: "/o/nit/posts/p1" });
  });
  it("links a company's post to its company page, with a verb per type", () => {
    expect(postNotice({ company: true, name: "Northwind", slug: "northwind" }, post("hiring"))).toEqual({ type: "post_hiring", title: "Northwind is hiring", href: "/c/northwind" });
    expect(postNotice({ company: true, name: "Northwind", slug: "northwind" }, post("milestone")).title).toBe("Northwind shared a milestone");
  });
  it("falls back to an update for a type it does not know", () => {
    expect(postNotice({ company: true, name: "Northwind", slug: "northwind" }, post("weird"))).toMatchObject({ type: "post_update", title: "Northwind posted an update" });
  });
});
