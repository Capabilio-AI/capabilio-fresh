import { describe, expect, it } from "vitest";
import { filterRoles, roleBlurb, FEATURED } from "./role-filter";

const roles = [
  { careerId: "1", name: "Cloud Engineer", aliases: ["cloud engineer", "devops", "devops engineer", "sre"] },
  { careerId: "2", name: "Data Analyst", aliases: ["data analyst", "analytics", "bi analyst"] },
  { careerId: "3", name: "Data Scientist", aliases: ["data scientist", "data science"] },
  { careerId: "4", name: "Game Developer", aliases: ["game developer", "unity developer"] },
  { careerId: "5", name: "Generative AI Engineer", aliases: ["genai engineer", "llm engineer"] },
];
const names = (t: string) => filterRoles(roles, t).map((h) => h.role.name);

describe("filterRoles", () => {
  it("lists featured roles first when nothing is typed", () => {
    const out = names("");
    expect(out.slice(0, 3)).toEqual(["Data Analyst", "Generative AI Engineer", "Cloud Engineer"].filter((n) => FEATURED.includes(n)).sort((a, b) => FEATURED.indexOf(a) - FEATURED.indexOf(b)));
    expect(out).toHaveLength(roles.length);
  });
  it("matches names, aliases and word starts, best first", () => {
    expect(names("data")).toEqual(["Data Analyst", "Data Scientist"]);
    expect(names("dev")).toEqual(["Cloud Engineer", "Game Developer"]);
    expect(filterRoles(roles, "devops")[0]).toMatchObject({ role: { name: "Cloud Engineer" }, matched: "devops" });
    expect(names("llm")).toEqual(["Generative AI Engineer"]);
    expect(names("analy").length).toBe(1);
  });
  it("matches several keywords across the name, then roles sharing some of them", () => {
    const more = [...roles, { careerId: "6", name: "Embedded Systems Engineer", aliases: ["firmware engineer"] }];
    const out = (t: string) => filterRoles(more, t).map((h) => h.role.name);
    expect(out("embedded engineer")[0]).toBe("Embedded Systems Engineer");
    expect(out("systems embedded")).toEqual(["Embedded Systems Engineer"]);
    expect(out("firmware engineer")[0]).toBe("Embedded Systems Engineer");
    expect(out("zoology engineer")).toContain("Cloud Engineer");
  });
  it("returns nothing for a role we do not have (the UI then offers 'use as typed')", () => {
    expect(names("zoologist")).toEqual([]);
  });
});

describe("suggestions for partial queries", () => {
  const catalog = [
    { careerId: "1", name: "Embedded Systems Engineer", aliases: ["embedded engineer", "firmware engineer"] },
    { careerId: "2", name: "Embedded Firmware Engineer", aliases: ["firmware developer"] },
    { careerId: "3", name: "Data Analyst", aliases: ["data analyst", "analytics"] },
    { careerId: "4", name: "Data Engineer", aliases: ["etl engineer"] },
    { careerId: "5", name: "Cybersecurity Analyst", aliases: ["soc analyst", "security analyst"] },
    { careerId: "6", name: "Product Designer", aliases: ["ux designer"] },
  ];
  const out = (t: string) => filterRoles(catalog, t).map((h) => h.role.name);

  it("offers the embedded roles for 'embed' and nothing unrelated", () => {
    expect(out("embed")).toEqual(["Embedded Firmware Engineer", "Embedded Systems Engineer"]);
  });
  it("narrows 'data an' to Data Analyst first", () => {
    expect(out("data an")[0]).toBe("Data Analyst");
    expect(out("data an")).not.toContain("Product Designer");
  });
  it("finds security roles for 'cyber' and for an alias like 'soc'", () => {
    expect(out("cyber")).toEqual(["Cybersecurity Analyst"]);
    expect(filterRoles(catalog, "soc")[0]).toMatchObject({ role: { name: "Cybersecurity Analyst" }, matched: "soc analyst" });
  });
  it("returns nothing for a role the catalog does not have, so the caller can resolve it instead of padding the list", () => {
    expect(out("financial")).toEqual([]);
  });
});

describe("roleBlurb", () => {
  it("shows a real description, shortened, and hides empty or placeholder ones", () => {
    expect(roleBlurb("Builds firmware.")).toBe("Builds firmware.");
    expect(roleBlurb("x".repeat(200))).toHaveLength(110);
    expect(roleBlurb("AI-proposed profile for Financial Analyst")).toBeNull();
    expect(roleBlurb(null)).toBeNull();
    expect(roleBlurb("  ")).toBeNull();
  });
});
