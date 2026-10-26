import type { CalcTemplate } from "./types";
import { relTol } from "./types";

/**
 * Panel electrical calculations for the PLC Automation Engineer role (area plc-electrical-calcs). Educational formulas stated in each ticket's reference
 * sheet and a fictional cable table; not an installation design and no claim of approval under any wiring code.
 */
const CAST = {
  panel: { name: "Prakash Nair", title: "Control Panel Lead" },
  plant: { name: "Sunita Deshmukh", title: "Plant Engineer" },
};

const SUPPLY_V = 415;
const DOL_START_FACTOR = 6;
/** fictional educational table: copper cable size (mm2) and the current it may carry under the reference conditions (A) */
const CABLE_TABLE: readonly (readonly [number, number])[] = [[1.5, 15], [2.5, 21], [4, 28], [6, 36], [10, 50], [16, 68], [25, 89], [35, 111]];
const PLUS_MINUS = "+/-2%";

const flcSheet = ["Three-phase motor: I = (P x 1000) / (sqrt(3) x V x pf x efficiency), P in kW, V in volts", `Direct-on-line starting current is taken as ${DOL_START_FACTOR} x full-load current`, `Answers are accepted within ${PLUS_MINUS}`];

export const PLC_CALC_TEMPLATES: CalcTemplate[] = [
  {
    id: "plc-calc-motor-flc",
    areas: ["plc-electrical-calcs"],
    difficulty: "easy",
    minLevel: "fresher",
    build(rng) {
      const kw = rng.pick([5.5, 7.5, 11, 15, 18.5, 22, 30]);
      const pf = rng.pick([0.8, 0.85, 0.88]);
      const eff = rng.pick([0.88, 0.9, 0.92]);
      const flc = (kw * 1000) / (Math.sqrt(3) * SUPPLY_V * pf * eff);
      const start = DOL_START_FACTOR * flc;
      return {
        title: "Motor full-load and starting current for the new pump",
        requester: CAST.panel,
        scenario: "The new transfer pump motor is going into the panel. I need its full-load current for the overload relay setting and its direct-on-line starting current for the supply check.",
        params: [
          { label: "Motor rating", value: String(kw), unit: "kW" },
          { label: "Supply (three-phase, line to line)", value: String(SUPPLY_V), unit: "V" },
          { label: "Power factor at full load", value: String(pf), unit: "" },
          { label: "Efficiency at full load", value: String(eff), unit: "" },
        ],
        fields: [
          { key: "flc", label: "Full-load current", unit: "A" },
          { key: "dol_start", label: "Direct-on-line starting current", unit: "A" },
        ],
        key: { expected: { flc, dol_start: start }, tolerance: { flc: relTol(flc), dol_start: relTol(start) } },
        reference: flcSheet,
      };
    },
  },
  {
    id: "plc-calc-4-20ma-scaling",
    areas: ["plc-electrical-calcs"],
    difficulty: "easy",
    minLevel: "fresher",
    build(rng) {
      const range = rng.pick([{ hi: 10, unit: "bar" }, { hi: 16, unit: "bar" }, { hi: 100, unit: "degC" }, { hi: 250, unit: "m3/h" }]);
      const reading = rng.int(12, 36) / 2;
      const fraction = rng.pick([0.25, 0.4, 0.5, 0.75]);
      const value = ((reading - 4) / 16) * range.hi;
      const setpoint = fraction * range.hi;
      const setpointMa = 4 + fraction * 16;
      return {
        title: "Scale the 4-20 mA transmitter into engineering units",
        requester: CAST.plant,
        scenario: "A two-wire transmitter feeds an analog input. The PLC reads the current in mA; I need the process value on the screen and the current the transmitter would give at the alarm setpoint, so we can check it at the panel.",
        params: [
          { label: "Transmitter range, 4 mA is zero and 20 mA is full scale: 0 to", value: String(range.hi), unit: range.unit },
          { label: "Current now read by the PLC", value: String(reading), unit: "mA" },
          { label: "Alarm setpoint", value: String(setpoint), unit: range.unit },
        ],
        fields: [
          { key: "value", label: "Process value now", unit: range.unit },
          { key: "setpoint_ma", label: "Current at the alarm setpoint", unit: "mA" },
        ],
        key: { expected: { value, setpoint_ma: setpointMa }, tolerance: { value: relTol(value, 0.02, 0.01), setpoint_ma: relTol(setpointMa, 0.02, 0.05) } },
        reference: ["Value = (I - 4) / 16 x full-scale range", "I = 4 + (value / full-scale range) x 16, I in mA", `Answers are accepted within ${PLUS_MINUS}`],
      };
    },
  },
  {
    id: "plc-calc-cable-derating",
    areas: ["plc-electrical-calcs"],
    difficulty: "medium",
    minLevel: "fresher",
    build(rng) {
      const load = rng.int(18, 60);
      const ambient = rng.pick([{ k: 0.87, text: "45 degC ambient" }, { k: 0.94, text: "35 degC ambient" }, { k: 1, text: "30 degC ambient" }]);
      const group = rng.pick([{ k: 0.7, text: "6 cables bunched in the tray" }, { k: 0.8, text: "3 cables bunched in the tray" }, { k: 1, text: "a single cable on its own" }]);
      const required = load / (ambient.k * group.k);
      const size = CABLE_TABLE.find(([, rating]) => rating >= required)![0];
      return {
        title: "Choose the cable for the new feeder",
        requester: CAST.panel,
        scenario: `A feeder cable carries a steady load and runs with ${ambient.text} and ${group.text}. Work out the table rating the cable must have once the derating is applied, and pick the smallest size from our table that is enough.`,
        params: [
          { label: "Load current", value: String(load), unit: "A" },
          { label: "Ambient temperature factor", value: String(ambient.k), unit: "" },
          { label: "Grouping factor", value: String(group.k), unit: "" },
        ],
        fields: [
          { key: "required_rating", label: "Required table rating", unit: "A" },
          { key: "size", label: "Smallest cable size that is enough", unit: "mm2" },
        ],
        key: { expected: { required_rating: required, size }, tolerance: { required_rating: relTol(required), size: 1e-9 } },
        reference: [
          "Required table rating = load current / (ambient factor x grouping factor)",
          "Pick the smallest size whose table rating is at least the required rating",
          `Educational table (size mm2: rating A): ${CABLE_TABLE.map(([s, r]) => `${s}: ${r}`).join(", ")}`,
          "Enter the size as a number in mm2. This is a classroom table and formula, not an approved installation design.",
        ],
      };
    },
  },
  {
    id: "plc-calc-pf-correction",
    areas: ["plc-electrical-calcs"],
    difficulty: "medium",
    minLevel: "fresher",
    build(rng) {
      const kw = rng.pick([40, 55, 75, 90, 110]);
      const pf1 = rng.pick([0.7, 0.74, 0.78, 0.82]);
      const pf2 = 0.95;
      const qc = kw * (Math.tan(Math.acos(pf1)) - Math.tan(Math.acos(pf2)));
      const kvaAfter = kw / pf2;
      return {
        title: "Size the capacitor bank for the compressor panel",
        requester: CAST.plant,
        scenario: "The compressor panel runs at a poor power factor and the electricity bill shows a penalty. I need the capacitor bank size to bring it up to the target, and the apparent power the supply then has to deliver.",
        params: [
          { label: "Real power drawn", value: String(kw), unit: "kW" },
          { label: "Present power factor", value: String(pf1), unit: "" },
          { label: "Target power factor", value: String(pf2), unit: "" },
        ],
        fields: [
          { key: "qc", label: "Capacitor bank required", unit: "kVAR" },
          { key: "kva_after", label: "Apparent power after correction", unit: "kVA" },
        ],
        key: { expected: { qc, kva_after: kvaAfter }, tolerance: { qc: relTol(qc, 0.03), kva_after: relTol(kvaAfter) } },
        reference: ["Qc = P x (tan(acos(pf_present)) - tan(acos(pf_target))), P in kW, result in kVAR", "S = P / pf, S in kVA", "Answers are accepted within +/-2% (+/-3% for Qc)"],
      };
    },
  },
];
