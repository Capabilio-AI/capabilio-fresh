// A Stream mission is a small, honest engineering lab: the student changes controls, runs a test, reads what the simulation says and
// works out why. Every lab is pure TypeScript with no randomness at test time, so the server can re-run exactly what the student saw.
import type { Rng } from "@/lib/workplace/rng";

export type Difficulty = "easy" | "medium" | "hard";
export type Family = "ece" | "eee" | "mech" | "civil";
/** A: interactive simulation, B: virtual lab, C: engineering puzzle, D: decision game */
export type MissionFormat = "simulation" | "lab" | "puzzle" | "decision";
export type Settings = Record<string, string | number>;

interface ControlBase {
  id: string;
  label: string;
  /** shown only while another (earlier) control has this value */
  when?: { id: string; value: string };
}
export interface ChoiceControl extends ControlBase {
  kind: "choice";
  options: { value: string; label: string }[];
  default: string;
}
export interface NumberControl extends ControlBase {
  kind: "number";
  min: number;
  max: number;
  step: number;
  unit: string;
  default: number;
  /** values the validator must always try, besides an even sample (for example the exact duty cycle a target needs) */
  focus?: number[];
}
export type Control = ChoiceControl | NumberControl;

export interface Reading {
  id: string;
  label: string;
  display: string;
  /** null when the reading is information only */
  ok: boolean | null;
  /** an optional gauge: the safe zone is low..high (either may be open) */
  bar?: { value: number; min: number; max: number; low?: number; high?: number };
}

export interface Objective {
  id: string;
  label: string;
  ok: boolean;
  /** what this run measured, in plain words */
  detail: string;
  /** a thought that points at the idea without giving the answer */
  nudge: string;
}

export interface Series {
  title: string;
  xLabel: string;
  yLabel: string;
  lines: { name: string; pts: [number, number][]; style?: "main" | "ref" | "limit" }[];
}

export interface Table {
  title: string;
  columns: string[];
  rows: string[][];
  /** row indexes to flag */
  bad: number[];
}

export interface Outcome {
  readings: Reading[];
  objectives: Objective[];
  passed: boolean;
  series?: Series;
  table?: Table;
}

export type Tone = "ink" | "accent" | "good" | "bad" | "muted" | "water";
export type SceneItem =
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; tone?: Tone; w?: number; dash?: boolean }
  | { k: "rect"; x: number; y: number; w: number; h: number; tone?: Tone; fill?: boolean }
  | { k: "circle"; x: number; y: number; r: number; tone?: Tone; fill?: boolean }
  | { k: "poly"; pts: [number, number][]; tone?: Tone; fill?: boolean; w?: number }
  | { k: "text"; x: number; y: number; text: string; size?: number; anchor?: "start" | "middle" | "end"; tone?: Tone };
/** A small drawing of the set-up, drawn from the current settings (never from a test result). */
export interface Scene {
  title: string;
  w: number;
  h: number;
  items: SceneItem[];
}

export interface HistoryEntry {
  settings: Settings;
  met: number;
  total: number;
}

export interface Lab<S = unknown> {
  key: string;
  family: Family;
  format: MissionFormat;
  /** the bench the student works at, e.g. "Rectifier bench" */
  name: string;
  /** the curriculum idea, e.g. "Analog Electronics · Diodes" */
  topic: string;
  /** course-title words this lab belongs to, lower case */
  keywords: string[];
  tools: string[];
  skillTags: string[];
  makeScenario(rng: Rng, d: Difficulty): S;
  /** the facts of the situation, shown to the student */
  given(s: S): { label: string; value: string }[];
  /** one line: what the student must achieve */
  mission(s: S): string;
  controls(s: S): Control[];
  /** pure and deterministic */
  evaluate(s: S, settings: Settings): Outcome;
  /** shown after the mission: why it behaves this way, with this run's numbers */
  explain(s: S, settings: Settings, o: Outcome): string;
  /** a story to use when the AI writes none (or writes something unsafe) */
  fallback(s: S): { title: string; story: string };
}
export type AnyLab = Lab<unknown>;
/** Keeps labs strongly typed on the inside while the registry holds them all. */
export const defineLab = <S>(lab: Lab<S>): AnyLab => lab as unknown as AnyLab;
