import { describe, expect, it } from "vitest";
import { chooseDomainSource } from "./domain-source";

describe("chooseDomainSource", () => {
  it("serves the workstation even when unpassed catalog tickets exist", () => {
    expect(chooseDomainSource({ hasWorkstation: true, catalogItems: 3, catalogCountdown: false })).toBe("workstation");
    expect(chooseDomainSource({ hasWorkstation: true, catalogItems: 0, catalogCountdown: true })).toBe("workstation");
  });

  it("serves the catalog only for a career without a workstation", () => {
    expect(chooseDomainSource({ hasWorkstation: false, catalogItems: 1, catalogCountdown: false })).toBe("catalog");
    expect(chooseDomainSource({ hasWorkstation: false, catalogItems: 0, catalogCountdown: true })).toBe("catalog");
  });

  it("reports none when there is nothing to serve", () => {
    expect(chooseDomainSource({ hasWorkstation: false, catalogItems: 0, catalogCountdown: false })).toBe("none");
  });
});
