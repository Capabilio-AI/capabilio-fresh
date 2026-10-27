import { describe, expect, it } from "vitest";
import { academicRegistrableDomain, decideAutoApproval, emailDomain } from "./domain-verification";

const base = { orgType: "institution" as const, role: "faculty", matchedExisting: true, institutionVerifiedDomain: "mvrcet.ac.in" };

describe("emailDomain", () => {
  it("lower-cases and rejects malformed addresses", () => {
    expect(emailDomain(" Hod@MVRCET.ac.in ")).toBe("mvrcet.ac.in");
    expect(emailDomain("no-at-sign")).toBeNull();
    expect(emailDomain("a@localhost")).toBeNull();
    expect(emailDomain("a@bad domain.com")).toBeNull();
  });
});

describe("academicRegistrableDomain", () => {
  it("collapses subdomains to the college's own domain", () => {
    expect(academicRegistrableDomain("a@cse.mvrcet.ac.in")).toBe("mvrcet.ac.in");
    expect(academicRegistrableDomain("a@mvrcet.ac.in")).toBe("mvrcet.ac.in");
    expect(academicRegistrableDomain("a@iitm.edu.in")).toBe("iitm.edu.in");
    expect(academicRegistrableDomain("a@cs.mit.edu")).toBe("mit.edu");
  });
  it("refuses non-academic domains and bare suffixes", () => {
    expect(academicRegistrableDomain("a@gmail.com")).toBeNull();
    expect(academicRegistrableDomain("a@mvrcet.com")).toBeNull();
    expect(academicRegistrableDomain("a@evil-ac.in")).toBeNull();
    expect(academicRegistrableDomain("a@ac.in")).toBeNull();
    expect(academicRegistrableDomain("a@notedu")).toBeNull();
  });
});

describe("decideAutoApproval", () => {
  it("verifies the domain of a brand-new college's founder", () => {
    expect(decideAutoApproval({ ...base, matchedExisting: false, role: "principal", institutionVerifiedDomain: null, email: "p@mvrcet.ac.in" })).toEqual({ verifyDomain: "mvrcet.ac.in", activate: false });
  });
  it("does not verify a founder with a free email", () => {
    expect(decideAutoApproval({ ...base, matchedExisting: false, institutionVerifiedDomain: null, email: "p@gmail.com" })).toEqual({ verifyDomain: null, activate: false });
  });
  it("activates faculty who join with the verified domain", () => {
    expect(decideAutoApproval({ ...base, email: "f@cse.mvrcet.ac.in" })).toEqual({ verifyDomain: null, activate: true });
  });
  it("keeps principal, HOD and TPO manual even on the verified domain", () => {
    for (const role of ["principal", "vice_principal", "hod", "tpo"]) expect(decideAutoApproval({ ...base, role, email: "x@mvrcet.ac.in" }).activate).toBe(false);
  });
  it("keeps other domains and unverified colleges manual", () => {
    expect(decideAutoApproval({ ...base, email: "f@other.ac.in" }).activate).toBe(false);
    expect(decideAutoApproval({ ...base, email: "f@gmail.com" }).activate).toBe(false);
    expect(decideAutoApproval({ ...base, institutionVerifiedDomain: null, email: "f@mvrcet.ac.in" }).activate).toBe(false);
  });
  it("never auto-approves companies", () => {
    expect(decideAutoApproval({ ...base, orgType: "company", email: "f@mvrcet.ac.in" })).toEqual({ verifyDomain: null, activate: false });
  });
});
