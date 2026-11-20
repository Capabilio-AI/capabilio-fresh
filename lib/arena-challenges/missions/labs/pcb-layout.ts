import { fmt, gauge, info, objective } from "../util";
import { defineLab, type Difficulty, type Lab, type Outcome } from "../types";
import { boxOf, centre, dist, findSpot, legality, type Board, type Box, type PartDef, type Pin, type Placement } from "../sim/pcb";

// Printed Circuit Board layout: the student places parts on a board and picks their values. The rules are the ones a layout review checks:
// decoupling next to the supply pin, crystal and its load capacitors close together, regulator capacitors at the regulator, heat kept apart.
interface S {
  level: Difficulty;
  mcuX: number;
  mcuY: number;
  connectorY: number;
  /** crystal load capacitance from its datasheet, picofarads */
  loadPf: number;
  supplyV: number;
  ledMa: number;
}

const COLS = 36;
const ROWS = 24;
const STRAY_PF = 3;
const LED_VF = 2;
const MAX_DESIGN = 2500;

const DEC_NF = [10, 100, 1000];
const CAP_PF = [6.8, 10, 15, 18, 22, 27, 33];
const BULK_UF = [0.1, 1, 4.7, 10, 22];
const R_OHM = [100, 150, 220, 330, 470, 680, 1000, 2200];
const label = (v: number, unit: string) => `${v} ${unit}`;

const LIMITS: Record<Difficulty, { dec: number; xtal: number; cl: number; bulk: number; reg: number; heat: number }> = {
  easy: { dec: 6, xtal: 10, cl: 6, bulk: 4, reg: 16, heat: 0 },
  medium: { dec: 5, xtal: 8, cl: 5, bulk: 4, reg: 13, heat: 0 },
  hard: { dec: 4, xtal: 7, cl: 4, bulk: 3.5, reg: 11, heat: 9 },
};

const board = (s: S): Board => ({
  cols: COLS,
  rows: ROWS,
  mcu: { x: s.mcuX, y: s.mcuY, w: 6, h: 6 },
  connector: { x: 0, y: s.connectorY, w: 3, h: 6 },
  keepouts: [{ x: COLS - 4, y: 0, w: 4, h: 3 }, { x: COLS - 4, y: ROWS - 3, w: 4, h: 3 }],
  pins: { vdd: { x: s.mcuX, y: s.mcuY + 1 }, oscA: { x: s.mcuX + 6, y: s.mcuY + 2 }, oscB: { x: s.mcuX + 6, y: s.mcuY + 3 }, power: { x: 3, y: s.connectorY + 1 } },
});
const oscMid = (b: Board): Pin => ({ x: b.pins.oscA.x, y: (b.pins.oscA.y + b.pins.oscB.y) / 2 });

function parts(level: Difficulty): PartDef[] {
  const base: PartDef[] = [
    { id: "cdec", label: "Decoupling capacitor", w: 2, h: 1, options: DEC_NF.map((v) => (v >= 1000 ? "1 µF" : label(v, "nF"))) },
    { id: "y1", label: "Crystal", w: 3, h: 2 },
    { id: "cl1", label: "Load capacitor A", w: 2, h: 1, options: CAP_PF.map((v) => label(v, "pF")) },
    { id: "cl2", label: "Load capacitor B", w: 2, h: 1, options: CAP_PF.map((v) => label(v, "pF")) },
  ];
  const power: PartDef[] = [
    { id: "u2", label: "Voltage regulator", w: 4, h: 3 },
    { id: "cin", label: "Regulator input capacitor", w: 2, h: 1, options: BULK_UF.map((v) => label(v, "µF")) },
    { id: "cout", label: "Regulator output capacitor", w: 2, h: 1, options: BULK_UF.map((v) => label(v, "µF")) },
  ];
  const led: PartDef[] = [
    { id: "led", label: "Status LED", w: 2, h: 1 },
    { id: "rled", label: "LED resistor", w: 2, h: 1, options: R_OHM.map((v) => (v >= 1000 ? `${v / 1000} kΩ` : label(v, "Ω"))) },
  ];
  return level === "easy" ? base : level === "medium" ? [...base, ...power] : [...base, ...power, ...led];
}

/** Design strings are untrusted: every field is checked, and anything unusable is dropped. */
function parseDesign(raw: unknown, defs: PartDef[]): Map<string, Placement> {
  const out = new Map<string, Placement>();
  if (typeof raw !== "string" || raw === "") return out;
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return out; }
  const p = (data as { p?: Record<string, unknown> })?.p;
  if (!p || typeof p !== "object") return out;
  for (const d of defs) {
    const e = p[d.id];
    if (!Array.isArray(e)) continue;
    const [x, y, v = 0] = e.map(Number);
    if (![x, y, v].every(Number.isInteger) || x < -COLS || y < -ROWS || x > COLS * 2 || y > ROWS * 2) continue;
    out.set(d.id, { x, y, v: d.options && v >= 0 && v < d.options.length ? v : 0 });
  }
  return out;
}
const encode = (m: Map<string, Placement>): string => JSON.stringify({ p: Object.fromEntries([...m].map(([k, v]) => [k, [v.x, v.y, v.v]])) });

const nearestIndex = (values: number[], target: number) => values.reduce((best, v, i) => (Math.abs(v - target) < Math.abs(values[best] - target) ? i : best), 0);
const clTarget = (s: S) => 2 * (s.loadPf - STRAY_PF);
const ledCurrent = (s: S, r: number) => ((s.supplyV - LED_VF) / r) * 1000;

function check(s: S, st: Record<string, string | number>) {
  const defs = parts(s.level);
  const placed = parseDesign(st.design, defs);
  const b = board(s);
  const lim = LIMITS[s.level];
  const has = (...ids: string[]) => ids.every((id) => placed.has(id));
  const at = (id: string) => placed.get(id)!;
  const def = (id: string) => defs.find((d) => d.id === id)!;
  const box = (id: string): Box => boxOf(def(id), at(id));
  const problems = legality(defs, placed, b);

  const dDec = has("cdec") ? dist(centre(box("cdec")), b.pins.vdd) : Infinity;
  const dXtal = has("y1") ? dist(centre(box("y1")), oscMid(b)) : Infinity;
  const dCl = has("cl1", "cl2", "y1") ? Math.max(dist(centre(box("cl1")), centre(box("y1"))), dist(centre(box("cl2")), centre(box("y1")))) : Infinity;
  const decOk = has("cdec") && DEC_NF[at("cdec").v] === 100;
  const clOk = has("cl1", "cl2") && [at("cl1").v, at("cl2").v].every((v) => Math.abs(CAP_PF[v] - clTarget(s)) / clTarget(s) <= 0.15);

  const regIn = has("u2") ? ({ x: box("u2").x, y: box("u2").y + 1.5 } as Pin) : null;
  const regOut = has("u2") ? ({ x: box("u2").x + 4, y: box("u2").y + 1.5 } as Pin) : null;
  const dReg = has("u2") ? dist(centre(box("u2")), b.pins.power) : Infinity;
  const dCin = has("cin", "u2") && regIn ? dist(centre(box("cin")), regIn) : Infinity;
  const dCout = has("cout", "u2") && regOut ? dist(centre(box("cout")), regOut) : Infinity;
  const cinOk = has("cin") && BULK_UF[at("cin").v] >= 1;
  const coutOk = has("cout") && BULK_UF[at("cout").v] >= 10 && BULK_UF[at("cout").v] <= 22;
  const heat = has("u2", "y1") ? dist(centre(box("u2")), centre(box("y1"))) : 0;
  const mA = has("rled") ? ledCurrent(s, R_OHM[at("rled").v]) : 0;
  const ledOk = has("led", "rled") && Math.abs(mA - s.ledMa) / s.ledMa <= 0.2;
  return { defs, placed, problems, lim, dDec, dXtal, dCl, decOk, clOk, dReg, dCin, dCout, cinOk, coutOk, heat, mA, ledOk, b, box, has };
}

/** The layout a careful engineer would draw: each part next to what it serves, values from the datasheet rules. */
function reference(s: S): { design: string } | null {
  const defs = parts(s.level);
  const b = board(s);
  const lim = LIMITS[s.level];
  const placed = new Map<string, Placement>();
  const taken: Box[] = [];
  const put = (id: string, anchor: Pin, v: number, extra?: (x: Box) => boolean): boolean => {
    const d = defs.find((x) => x.id === id);
    if (!d) return true;
    const spot = findSpot(d, anchor, b, taken, extra);
    if (!spot) return false;
    placed.set(id, { ...spot, v });
    taken.push(boxOf(d, spot));
    return true;
  };
  const cl = nearestIndex(CAP_PF, clTarget(s));
  if (!put("y1", oscMid(b), 0)) return null;
  const y1 = centre(taken[taken.length - 1]);
  if (!put("cl1", y1, cl) || !put("cl2", y1, cl) || !put("cdec", b.pins.vdd, 1)) return null;
  if (defs.some((d) => d.id === "u2")) {
    const farFromCrystal = (x: Box) => lim.heat === 0 || dist(centre(x), y1) >= lim.heat + 1;
    if (!put("u2", b.pins.power, 0, farFromCrystal)) return null;
    const u2 = taken[taken.length - 1];
    if (!put("cin", { x: u2.x, y: u2.y + 1.5 }, 1) || !put("cout", { x: u2.x + 4, y: u2.y + 1.5 }, 3)) return null;
  }
  if (defs.some((d) => d.id === "led")) {
    const target = nearestIndex(R_OHM.map((r) => ledCurrent(s, r)), s.ledMa);
    const home = { x: COLS * 0.7, y: ROWS * 0.7 };
    if (!put("led", home, 0) || !put("rled", home, target)) return null;
  }
  return { design: encode(placed) };
}

const lab: Lab<S> = {
  key: "pcb-layout",
  family: "ece",
  format: "puzzle",
  surface: "pcb",
  name: "PCB layout studio",
  topic: "Electronic Circuits · PCB layout and component selection",
  keywords: ["pcb", "electronic circuits", "analog electronics", "digital electronics", "embedded", "microcontroller", "vlsi", "electronic devices", "circuit"],
  tools: ["Board canvas", "Parts tray", "Value picker", "Design-rule check"],
  skillTags: ["PCB placement", "Decoupling", "Crystal loading", "Component selection"],
  makeScenario(rng, d) {
    return { level: d, mcuX: rng.int(11, 17), mcuY: rng.int(5, 11), connectorY: rng.int(3, 14), loadPf: rng.pick([8, 12, 18]), supplyV: rng.pick([3.3, 5]), ledMa: rng.pick([5, 8, 10]) };
  },
  given: (s) => {
    const lim = LIMITS[s.level];
    const rows = [
      { label: "Board", value: `${COLS} × ${ROWS} mm, MCU and connector fixed` },
      { label: "Decoupling capacitor", value: `100 nF within ${lim.dec} mm of the MCU supply pin` },
      { label: "Crystal", value: `${s.loadPf} pF load, within ${lim.xtal} mm of the MCU; load capacitors within ${lim.cl} mm of it (board stray ${STRAY_PF} pF)` },
    ];
    if (s.level !== "easy") rows.push({ label: "Regulator", value: `within ${lim.reg} mm of the power connector; input capacitor ≥ 1 µF and output 10–22 µF, each within ${lim.bulk} mm of its pin` });
    if (s.level === "hard") rows.push({ label: "LED and heat", value: `${s.ledMa} mA from ${s.supplyV} V (LED drops ${LED_VF} V, ±20%); regulator at least ${lim.heat} mm from the crystal` });
    return rows;
  },
  mission: (s) => `Place every part on the board without overlaps and choose each value so the design-rule check passes: the 100 nF decoupler by the MCU supply pin, the ${s.loadPf} pF crystal and its load capacitors by the oscillator pins${s.level !== "easy" ? ", the regulator and its capacitors by the power input" : ""}${s.level === "hard" ? ", a correctly-resistored LED, and the regulator's heat kept away from the crystal" : ""}.`,
  controls: () => [{ kind: "design", id: "design", label: "Board layout", default: "", maxLen: MAX_DESIGN }],
  surfaceData: (s) => {
    const b = board(s);
    const lim = LIMITS[s.level];
    return { cols: COLS, rows: ROWS, mcu: b.mcu, connector: b.connector, keepouts: b.keepouts, pins: b.pins, parts: parts(s.level), limits: lim, level: s.level };
  },
  reference,
  evaluate(s, st): Outcome {
    const c = check(s, st);
    const { lim } = c;
    const mm = (v: number) => (Number.isFinite(v) ? `${fmt(v, 1)} mm` : "not placed");
    const objectives = [
      objective("place", "Every part is placed legally", c.problems.length === 0, c.problems[0] ?? "all parts placed, none overlapping", "Drag every part from the tray onto the board. Parts cannot overlap each other, the MCU, the connector or the mounting-hole corners."),
      objective("decouple", `Decoupler: 100 nF within ${lim.dec} mm of the supply pin`, c.dDec <= lim.dec && c.decOk, `${mm(c.dDec)}, ${c.has("cdec") ? c.defs[0].options![c.placed.get("cdec")!.v] : "no value"}`, "The decoupling capacitor supplies the chip's sudden current bursts. The longer the trace to it, the less it helps, so put it right by the supply pin, and pick the usual 100 nF."),
      objective("crystal", `Crystal ≤ ${lim.xtal} mm from the MCU, load capacitors ≈ ${fmt(clTarget(s), 0)} pF within ${lim.cl} mm`, c.dXtal <= lim.xtal && c.dCl <= lim.cl && c.clOk, `${mm(c.dXtal)} to the MCU, caps ${mm(c.dCl)} from the crystal${c.clOk ? "" : ", wrong capacitor value"}`, `A crystal runs at its rated frequency only with the right load. Each load capacitor is about 2 × (CL − stray) = 2 × (${s.loadPf} − ${STRAY_PF}) pF, and both must sit right beside the crystal.`),
    ];
    if (s.level !== "easy") objectives.push(objective("power", `Regulator within ${lim.reg} mm of the connector, capacitors at its pins`, c.dReg <= lim.reg && c.dCin <= lim.bulk && c.dCout <= lim.bulk && c.cinOk && c.coutOk, `regulator ${mm(c.dReg)} from the connector, capacitors ${mm(c.dCin)} / ${mm(c.dCout)}${c.cinOk && c.coutOk ? "" : ", value outside the datasheet range"}`, "The regulator datasheet asks for at least 1 µF at the input and 10 to 22 µF at the output, placed right at the pins, and the regulator itself should be near where the power comes in."));
    if (s.level === "hard") {
      objectives.push(objective("led", `LED current within 20% of ${s.ledMa} mA`, c.ledOk, c.has("rled") ? `${fmt(c.mA, 1)} mA` : "not placed", `Current is (${s.supplyV} V − ${LED_VF} V) ÷ R. Choose the resistor that gives about ${s.ledMa} mA from the values on offer.`));
      objectives.push(objective("heat", `Regulator ≥ ${lim.heat} mm from the crystal`, c.heat >= lim.heat, c.has("u2", "y1") ? mm(c.heat) : "not placed", "A regulator heats the board, and a crystal drifts in frequency when it warms. Keep them apart."));
    }
    const failing = [
      !c.decOk || c.dDec > lim.dec ? ["cdec"] : [],
      c.dXtal > lim.xtal ? ["y1"] : [],
      c.dCl > lim.cl || !c.clOk ? ["cl1", "cl2"] : [],
      s.level !== "easy" && (c.dReg > lim.reg ? ["u2"] : []).concat(c.dCin > lim.bulk || !c.cinOk ? ["cin"] : [], c.dCout > lim.bulk || !c.coutOk ? ["cout"] : []),
      s.level === "hard" && (!c.ledOk ? ["rled"] : []).concat(c.heat < lim.heat ? ["u2"] : []),
    ].flat().filter((x): x is string => typeof x === "string");
    const net = [c.dDec, c.dXtal, c.dCl, c.dCin, c.dCout, c.dReg].filter(Number.isFinite).reduce((a, v) => a + v, 0);
    return {
      readings: [
        gauge("dec", "Decoupler distance", Number.isFinite(c.dDec) ? c.dDec : lim.dec * 3, mm(c.dDec), { min: 0, max: lim.dec * 3, high: lim.dec }),
        gauge("xtal", "Crystal distance", Number.isFinite(c.dXtal) ? c.dXtal : lim.xtal * 3, mm(c.dXtal), { min: 0, max: lim.xtal * 3, high: lim.xtal }),
        info("net", "Wire length that must be routed", `${fmt(net, 0)} mm`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      overlay: { failing: [...new Set(failing)] },
    };
  },
  explain(s, st) {
    const c = check(s, st);
    return `Your layout puts the decoupling capacitor ${fmt(c.dDec, 1)} mm from the MCU supply pin and the crystal ${fmt(c.dXtal, 1)} mm from its oscillator pins. Short loops matter because every extra millimetre of trace adds inductance, which slows the capacitor's response and radiates noise. The load capacitors follow C = 2 × (CL − stray) = ${fmt(clTarget(s), 0)} pF so the crystal oscillates on frequency.`;
  },
  fallback: (s) => ({ title: `Lay out the ${s.level === "hard" ? "power and clock" : "clock"} section of a sensor board`, story: `A small sensor board has failed its first EMC test because the supply and clock parts were scattered. The engineer has to re-place them so the loops are short and the values match the datasheets.` }),
};
export default defineLab(lab);
