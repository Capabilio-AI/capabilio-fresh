import { describe, expect, it } from "vitest";
import { analyseTruss, MATERIALS } from "./truss";

const material = MATERIALS.steel;
// triangle: pin at A, roller at B, 10 kN down at the apex C; with the tie A-B the statics are known by hand
const joints = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 1.5 }];
const supports = [{ joint: 0, kind: "pin" as const }, { joint: 1, kind: "roller" as const }];
const loads = [{ joint: 2, fx: 0, fy: -10 }];

describe("analyseTruss", () => {
  it("matches the hand solution for a loaded triangle", () => {
    const r = analyseTruss({ joints, supports, loads, material, members: [{ a: 0, b: 2, size: 2 }, { a: 2, b: 1, size: 2 }, { a: 0, b: 1, size: 2 }] });
    expect(r.stable).toBe(true);
    expect(r.forces[0]).toBeCloseTo(-8.333, 2); // rafters in compression: P / (2 sin θ), sin θ = 0.6
    expect(r.forces[1]).toBeCloseTo(-8.333, 2);
    expect(r.forces[2]).toBeCloseTo(6.667, 2); // the tie carries the horizontal thrust
    expect(r.maxDeflectionMm).toBeGreaterThan(0);
  });
  it("calls a truss without its tie a mechanism, and a loaded joint with no member unstable", () => {
    const open = analyseTruss({ joints, supports, loads, material, members: [{ a: 0, b: 2, size: 2 }, { a: 2, b: 1, size: 2 }] });
    expect(open.stable).toBe(false);
    const loose = analyseTruss({ joints, supports, loads, material, members: [{ a: 0, b: 1, size: 2 }] });
    expect(loose.stable).toBe(false);
    expect(analyseTruss({ joints, supports, loads, material, members: [] }).stable).toBe(false);
  });
  it("gives a longer compression member a higher utilisation than a stubby one of the same force (buckling)", () => {
    const light = analyseTruss({ joints, supports, loads, material, members: [{ a: 0, b: 2, size: 0 }, { a: 2, b: 1, size: 0 }, { a: 0, b: 1, size: 2 }] });
    const heavy = analyseTruss({ joints, supports, loads, material, members: [{ a: 0, b: 2, size: 2 }, { a: 2, b: 1, size: 2 }, { a: 0, b: 1, size: 2 }] });
    expect(light.utilisation[0]).toBeGreaterThan(heavy.utilisation[0]);
    expect(light.massKg).toBeLessThan(heavy.massKg);
  });
});
