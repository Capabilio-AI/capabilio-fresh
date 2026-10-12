import { describe, expect, it } from "vitest";
import { ResumeExtractionSchema } from "@/lib/ai/llm/prompts/resume.v1";
import { vaultEntriesFrom } from "./apply";

const x = ResumeExtractionSchema.parse({
  isResume: true,
  personal: { fullName: "Asha Rao", links: [{ label: "GitHub", url: "github.com/asha" }, { label: "Bad", url: "javascript:alert(1)" }] },
  experience: [{ title: "Data intern", organisation: "Acme", kind: "internship", period: "Jan to Jun 2025", description: "Built weekly reports." }],
  projects: [{ name: "Sales dashboard", description: "Power BI dashboard for regional sales.", url: "https://example.com/p", skills: ["Power BI", "SQL"] }],
  certifications: [{ name: "Google Data Analytics", issuer: "Google", year: 2025 }],
});

describe("vaultEntriesFrom", () => {
  const out = vaultEntriesFrom(x);
  it("turns projects, internships, certificates and links into vault entries", () => {
    expect(out.map((v) => v.item_type)).toEqual(["project", "other", "certificate", "link"]);
    expect(out[0]).toMatchObject({ title: "Sales dashboard", url: "https://example.com/p" });
    expect(out[0].description).toContain("Skills: Power BI, SQL.");
    expect(out[1].title).toBe("Internship: Data intern at Acme");
    expect(out[2]).toMatchObject({ title: "Google Data Analytics", description: "Google, 2025" });
  });
  it("keeps only real web links: a script URL is dropped, a bare domain gets https", () => {
    const links = out.filter((v) => v.item_type === "link");
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe("https://github.com/asha");
  });
  it("respects the vault's column limits", () => {
    const long = ResumeExtractionSchema.parse({ isResume: true, projects: [{ name: "P".repeat(150), description: "d".repeat(590), skills: Array.from({ length: 12 }, (_, i) => `Skill ${i}`) }] });
    const [p] = vaultEntriesFrom(long);
    expect(p.title.length).toBeLessThanOrEqual(200);
    expect((p.description ?? "").length).toBeLessThanOrEqual(1000);
  });
});
