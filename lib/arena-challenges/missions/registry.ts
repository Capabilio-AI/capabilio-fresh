import type { AnyLab, Family } from "./types";
import rectifier from "./labs/rectifier";
import led from "./labs/led";
import rcFilter from "./labs/rc-filter";
import logicGate from "./labs/logic-gate";
import buck from "./labs/buck";
import pid from "./labs/pid";
import voltageRegulation from "./labs/voltage-regulation";
import beam from "./labs/beam";
import otto from "./labs/otto";
import pipe from "./labs/pipe";
import rccColumn from "./labs/rcc-column";
import foundation from "./labs/foundation";
import construction from "./labs/construction";
import amplifier from "./labs/amplifier";
import dcMotor from "./labs/dc-motor";
import solarFarm from "./labs/solar-farm";
import crane from "./labs/crane";
import heatExchanger from "./labs/heat-exchanger";
import levelling from "./labs/levelling";
import signalTiming from "./labs/signal-timing";

export const LABS: AnyLab[] = [rectifier, led, rcFilter, logicGate, buck, pid, voltageRegulation, beam, otto, pipe, rccColumn, foundation, construction, amplifier, dcMotor, solarFarm, crane, heatExchanger, levelling, signalTiming];
const BY_KEY = new Map(LABS.map((l) => [l.key, l]));

export const labByKey = (key: string): AnyLab | undefined => BY_KEY.get(key);
export const labsFor = (family: Family): AnyLab[] => LABS.filter((l) => l.family === family);

/** Pure. Which family of labs a branch belongs to, from the branch as recorded. Null for branches that have no labs yet. */
export function labFamily(branch: string): Family | null {
  const b = ` ${branch.toLowerCase()} `;
  if (/electronics and communication|\bece\b|telecommunication|electronics & communication/.test(b)) return "ece";
  if (/electrical|\beee\b|\bee\b/.test(b)) return "eee";
  if (/mechanical|\bmech\b|automobile|automotive|production|industrial engineering|mechatronics/.test(b)) return "mech";
  if (/civil|\bcivil\b|construction/.test(b)) return "civil";
  return null;
}
