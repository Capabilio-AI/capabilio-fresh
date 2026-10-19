import { describe, expect, it } from "vitest";
import { filterRoles, FEATURED } from "./role-filter";

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
