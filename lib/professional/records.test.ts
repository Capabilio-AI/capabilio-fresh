import { describe, expect, it } from "vitest";
import { ProResumeSchema } from "./resume-schema";
import { normUrl, recordsFromResume, validateCert, validateEdu, validateLink, validateProject } from "./records";

describe("normUrl", () => {
  it("adds https, keeps http, and refuses other schemes and non-addresses", () => {
    expect(normUrl("github.com/ana")).toBe("https://github.com/ana");
    expect(normUrl("http://example.com/x")).toBe("http://example.com/x");
    expect(normUrl("javascript:alert(1)")).toBeNull();
    expect(normUrl("not a url")).toBeNull();
    expect(normUrl("localhost")).toBeNull();
  });
});

describe("validators", () => {
  it("accepts a certification and checks the year", () => {
    expect(validateCert({ name: " AWS  SAA ", issuer: "Amazon", year: "2024" })).toEqual({ ok: true, value: { name: "AWS SAA", issuer: "Amazon", year: 2024 } });
    expect(validateCert({ name: "X", year: 1800 }).ok).toBe(false);
    expect(validateCert({ name: "" }).ok).toBe(false);
  });
  it("accepts education and refuses an end before a start", () => {
    expect(validateEdu({ institution: "IIT Madras", degree: "BTech", startYear: 2008, endYear: 2012 }).ok).toBe(true);
    expect(validateEdu({ institution: "IIT", startYear: 2012, endYear: 2008 }).ok).toBe(false);
  });
  it("accepts a project, de-duplicates skills and normalises the link", () => {
    expect(validateProject({ name: "Ledger", url: "example.com/p", skills: "Go, SQL, go" })).toEqual({ ok: true, value: { name: "Ledger", description: null, url: "https://example.com/p", skills: ["Go", "SQL"] } });
    expect(validateProject({ name: "Ledger", url: "ftp://x.y" }).ok).toBe(false);
  });
  it("accepts a link", () => expect(validateLink({ label: "GitHub", url: "github.com/ana" })).toEqual({ ok: true, value: { label: "GitHub", url: "https://github.com/ana" } }));
});

describe("recordsFromResume", () => {
  it("keeps the usable records and drops the unusable", () => {
    const x = ProResumeSchema.parse({
      isResume: true,
      personal: { links: [{ label: "GitHub", url: "github.com/ana" }, { label: "Bad", url: "nope" }] },
      education: [{ institution: "University of Hertfordshire", degree: "Master", fieldOfStudy: "Cyber Security", startYear: 2020, endYear: 2022 }],
      certifications: [{ name: "Google Data Analytics", issuer: "Google", year: 2024 }],
      projects: [{ name: "Dashboard", description: "KPIs", url: null, skills: ["Tableau"] }],
    });
    const r = recordsFromResume(x);
    expect(r.links).toEqual([{ label: "GitHub", url: "https://github.com/ana" }]);
    expect(r.education[0]).toMatchObject({ institution: "University of Hertfordshire", endYear: 2022 });
    expect(r.certifications).toEqual([{ name: "Google Data Analytics", issuer: "Google", year: 2024 }]);
    expect(r.projects[0].skills).toEqual(["Tableau"]);
  });
});
