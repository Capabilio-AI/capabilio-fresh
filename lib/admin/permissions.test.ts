import { describe, expect, it } from "vitest";
import { can, checkNewPassword, homeFor, maskEmail } from "./permissions";

describe("can", () => {
  it("lets only an owner manage the team and only owner and reviewer decide", () => {
    expect(can({ role: "owner", hideContacts: false }, "team")).toBe(true);
    expect(can({ role: "reviewer", hideContacts: false }, "team")).toBe(false);
    expect(can({ role: "reviewer", hideContacts: false }, "decide")).toBe(true);
    expect(can({ role: "analyst", hideContacts: false }, "decide")).toBe(false);
    expect(can({ role: "support", hideContacts: false }, "decide")).toBe(false);
  });
  it("keeps a reviewer from exporting and an analyst from lists only when told so", () => {
    expect(can({ role: "reviewer", hideContacts: false }, "export")).toBe(false);
    expect(can({ role: "analyst", hideContacts: false }, "export")).toBe(true);
    expect(can({ role: "analyst", hideContacts: true }, "export")).toBe(false);
    expect(can({ role: "analyst", hideContacts: true }, "contacts")).toBe(false);
    expect(can({ role: "analyst", hideContacts: true }, "lists")).toBe(true);
  });
  it("gives support a lookup and nothing else", () => {
    const s = { role: "support", hideContacts: false } as const;
    expect(can(s, "lookup")).toBe(true);
    expect(can(s, "lists")).toBe(false);
    expect(can(s, "view")).toBe(false);
    expect(homeFor(s)).toBe("/admin/people");
    expect(homeFor({ role: "owner", hideContacts: false })).toBe("/admin");
  });
});

describe("maskEmail", () => {
  it("hides most of an address", () => {
    expect(maskEmail("asha@college.edu")).toBe("a•••@c•••.edu");
    expect(maskEmail(null)).toBe("—");
  });
});

describe("checkNewPassword", () => {
  it("asks for length, a number and no email name", () => {
    expect(checkNewPassword("short1", null).ok).toBe(false);
    expect(checkNewPassword("alllettersnonumber", null).ok).toBe(false);
    expect(checkNewPassword("admin-capabilio-2026", "admin@capabilio.online").ok).toBe(false);
    expect(checkNewPassword("river-stone-lamp-91", "admin@capabilio.online").ok).toBe(true);
  });
});
