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
import sampling from "./labs/sampling";
import firFilter from "./labs/fir-filter";
import digitalLink from "./labs/digital-link";
import amModulation from "./labs/am-modulation";
import tlineMatch from "./labs/tline-match";
import mcuPwm from "./labs/mcu-pwm";
import rlcStep from "./labs/rlc-step";
import transformer from "./labs/transformer";
import inductionMotor from "./labs/induction-motor";
import relayCoordination from "./labs/relay-coordination";
import evRange from "./labs/ev-range";
import vibrationIsolation from "./labs/vibration-isolation";
import refrigeration from "./labs/refrigeration";
import hydraulicCylinder from "./labs/hydraulic-cylinder";
import finHeatSink from "./labs/fin-heat-sink";
import concreteMix from "./labs/concrete-mix";
import retainingWall from "./labs/retaining-wall";
import openChannel from "./labs/open-channel";
import reservoir from "./labs/reservoir";
import cacheSim from "./labs/cache-sim";
import cpuScheduler from "./labs/cpu-scheduler";
import pageReplacement from "./labs/page-replacement";
import subnetPlanner from "./labs/subnet-planner";
import hashTable from "./labs/hash-table";
import dbIndex from "./labs/db-index";
import loadBalancer from "./labs/load-balancer";
import sortProfiler from "./labs/sort-profiler";
import mlThreshold from "./labs/ml-threshold";

export const LABS: AnyLab[] = [rectifier, led, rcFilter, logicGate, buck, pid, voltageRegulation, beam, otto, pipe, rccColumn, foundation, construction, amplifier, dcMotor, solarFarm, crane, heatExchanger, levelling, signalTiming, sampling, firFilter, digitalLink, amModulation, tlineMatch, mcuPwm, rlcStep, transformer, inductionMotor, relayCoordination, evRange, vibrationIsolation, refrigeration, hydraulicCylinder, finHeatSink, concreteMix, retainingWall, openChannel, reservoir, cacheSim, cpuScheduler, pageReplacement, subnetPlanner, hashTable, dbIndex, loadBalancer, sortProfiler, mlThreshold];
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
  if (/computer science|information technology|artificial intelligence|machine learning|data science|\bcse\b|\bit\b|csbs|cyber|software/.test(b)) return "it";
  return null;
}
