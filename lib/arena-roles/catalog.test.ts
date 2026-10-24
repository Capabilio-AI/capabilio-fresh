import { describe, expect, it } from "vitest";
import { ROLE_CATALOG, STREAMS, STREAM_SIZES, catalogRole, catalogRoleForDomainKey } from "./catalog";

describe("Arena role catalog", () => {
  it("has exactly 45 roles", () => {
    expect(ROLE_CATALOG).toHaveLength(45);
  });

  it("has the required number of roles in each stream", () => {
    for (const stream of STREAMS) expect(ROLE_CATALOG.filter((r) => r.stream === stream)).toHaveLength(STREAM_SIZES[stream]);
    expect(Object.values(STREAM_SIZES).reduce((a, b) => a + b, 0)).toBe(45);
  });

  it("uses unique, well-formed IDs and unique names", () => {
    expect(new Set(ROLE_CATALOG.map((r) => r.id)).size).toBe(45);
    expect(new Set(ROLE_CATALOG.map((r) => r.name)).size).toBe(45);
    for (const r of ROLE_CATALOG) expect(r.id).toBe(`${r.stream}-${r.id.slice(-2)}`);
  });

  it("numbers roles 1..45 in build order, IT first and Data Analyst first", () => {
    expect(ROLE_CATALOG.map((r) => r.order)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
    expect(ROLE_CATALOG[0].id).toBe("IT-01");
    expect(ROLE_CATALOG[0].name).toBe("Data Analyst");
    expect(ROLE_CATALOG[44].id).toBe("MCA-05");
  });

  it("numbers roles within a stream consecutively from 01", () => {
    for (const stream of STREAMS) {
      const ids = ROLE_CATALOG.filter((r) => r.stream === stream).map((r) => r.id);
      expect(ids).toEqual(ids.map((_, i) => `${stream}-${String(i + 1).padStart(2, "0")}`));
    }
  });

  it("includes the cybersecurity and QA roles that must not be dropped", () => {
    expect(catalogRole("IT-11")?.name).toMatch(/SOC/);
    expect(catalogRole("IT-12")?.name).toMatch(/Penetration/);
    expect(catalogRole("IT-15")?.name).toBe("QA Automation Engineer");
  });

  it("never shares a domain role key between two catalog roles", () => {
    const keys = ROLE_CATALOG.flatMap((r) => (r.domainRoleKey ? [r.domainRoleKey] : []));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("looks roles up exactly, with no fallback", () => {
    expect(catalogRole("IT-01")?.domainRoleKey).toBe("data-analyst");
    expect(catalogRole("it-01")).toBeNull();
    expect(catalogRole("IT-99")).toBeNull();
    expect(catalogRoleForDomainKey("data-analyst")?.id).toBe("IT-01");
    expect(catalogRoleForDomainKey("no-such-role")).toBeNull();
  });
});
