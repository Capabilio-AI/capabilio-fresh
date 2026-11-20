import { describe, expect, it } from "vitest";
import { analyseNetwork, headLoss } from "./network";
import { legality, findSpot, type Board, type PartDef } from "./pcb";
import { opTime } from "./tcc";

describe("relay curve", () => {
  it("matches the IEC standard-inverse formula and never trips below pickup", () => {
    expect(opTime(1000, 100, 1)).toBeCloseTo(0.14 / (10 ** 0.02 - 1), 6); // 10 times pickup, TMS 1: about 3.0 s
    expect(opTime(104, 100, 1)).toBe(Infinity);
    expect(opTime(1000, 100, 0.5)).toBeCloseTo(opTime(1000, 100, 1) / 2, 6);
  });
});

describe("water network", () => {
  it("accumulates downstream demand and loses head with the Hazen-Williams equation", () => {
    // reservoir -> node 1 -> node 2: pipe 0 carries both demands
    const r = analyseNetwork({ head: 50, elev: [0, 0], demandLps: [10, 15], parent: [0, 1], length: [500, 300], diameterMm: [200, 150], c: 130 });
    expect(r.flowLps).toEqual([25, 15]);
    expect(r.lossM[0]).toBeCloseTo(headLoss(500, 25, 200, 130), 6);
    expect(r.pressureM[1]).toBeCloseTo(50 - r.lossM[0] - r.lossM[1], 6);
    // a bigger pipe always loses less head
    expect(headLoss(500, 25, 250, 130)).toBeLessThan(headLoss(500, 25, 200, 130));
  });
});

describe("pcb legality", () => {
  const board: Board = { cols: 20, rows: 10, mcu: { x: 8, y: 3, w: 4, h: 4 }, connector: { x: 0, y: 0, w: 2, h: 4 }, keepouts: [{ x: 16, y: 0, w: 4, h: 2 }], pins: { vdd: { x: 8, y: 4 }, oscA: { x: 12, y: 4 }, oscB: { x: 12, y: 5 }, power: { x: 2, y: 1 } } };
  const defs: PartDef[] = [{ id: "a", label: "Cap A", w: 2, h: 1 }, { id: "b", label: "Cap B", w: 2, h: 1 }];
  it("rejects overlaps, off-board parts and parts on the MCU, and accepts a clean layout", () => {
    expect(legality(defs, new Map([["a", { x: 5, y: 8, v: 0 }], ["b", { x: 5, y: 8, v: 0 }]]), board).join(" ")).toMatch(/overlaps/);
    expect(legality(defs, new Map([["a", { x: 19, y: 8, v: 0 }], ["b", { x: 5, y: 8, v: 0 }]]), board).join(" ")).toMatch(/hangs off/);
    expect(legality(defs, new Map([["a", { x: 9, y: 4, v: 0 }], ["b", { x: 5, y: 8, v: 0 }]]), board).join(" ")).toMatch(/MCU/);
    expect(legality(defs, new Map([["a", { x: 5, y: 8, v: 0 }], ["b", { x: 8, y: 8, v: 0 }]]), board)).toEqual([]);
  });
  it("finds the nearest legal spot to an anchor", () => {
    const spot = findSpot(defs[0], { x: 7, y: 4 }, board, []);
    expect(spot).not.toBeNull();
    expect(legality([defs[0]], new Map([["a", spot!]]), board)).toEqual([]);
  });
});
