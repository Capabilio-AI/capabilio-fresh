// Settings handling shared by every lab: validate what a client sent, walk the space of possible settings, and find the closest working one.
import type { AnyLab, Control, Difficulty, Settings } from "./types";

const MAX_PER_CONTROL = 24;
const MAX_COMBOS = 30_000;

const isActive = (c: Control, settings: Settings): boolean => !c.when || String(settings[c.when.id]) === c.when.value;
export const activeControls = (controls: Control[], settings: Settings): Control[] => controls.filter((c) => isActive(c, settings));
export const defaultSettings = (controls: Control[]): Settings => Object.fromEntries(controls.map((c) => [c.id, c.default]));

function decimals(step: number): number {
  const t = String(step);
  return t.includes(".") ? t.split(".")[1].length : 0;
}

/** Every value a number control can take (all steps, or an even sample when there are too many). */
export function numberValues(c: Extract<Control, { kind: "number" }>, cap = MAX_PER_CONTROL): number[] {
  const count = Math.floor((c.max - c.min) / c.step + 1e-9) + 1;
  const d = decimals(c.step);
  const at = (i: number) => Number((c.min + i * c.step).toFixed(d));
  if (count <= cap) return Array.from({ length: count }, (_, i) => at(i));
  const sample = Array.from({ length: cap }, (_, i) => at(Math.round((i * (count - 1)) / (cap - 1))));
  const extra = (c.focus ?? []).flatMap((f) => [Math.floor((f - c.min) / c.step), Math.ceil((f - c.min) / c.step)]).filter((i) => i >= 0 && i < count).map(at);
  return [...new Set([...sample, ...extra])].sort((a, b) => a - b);
}

/** Pure. Accepts only values the controls offer; anything missing takes the default. Never trusts the client. */
export function normalizeSettings(controls: Control[], input: unknown): { ok: true; settings: Settings } | { ok: false; error: string } {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const settings: Settings = {};
  for (const c of controls) {
    const v = raw[c.id];
    if (v === undefined || v === null) {
      settings[c.id] = c.default;
      continue;
    }
    if (c.kind === "choice") {
      if (typeof v !== "string" || !c.options.some((o) => o.value === v)) return { ok: false, error: `"${c.label}" has an invalid choice.` };
      settings[c.id] = v;
    } else {
      const n = typeof v === "number" ? v : Number.NaN;
      const steps = (n - c.min) / c.step;
      if (!Number.isFinite(n) || n < c.min - 1e-9 || n > c.max + 1e-9 || Math.abs(steps - Math.round(steps)) > 1e-6) return { ok: false, error: `"${c.label}" must be between ${c.min} and ${c.max} in steps of ${c.step}.` };
      settings[c.id] = Number(n.toFixed(decimals(c.step)));
    }
  }
  return { ok: true, settings };
}

/** Every combination of the controls that matter (inactive controls stay at their default, so nothing is counted twice). */
export function* gridSettings(controls: Control[], cap = MAX_PER_CONTROL): Generator<Settings> {
  function* walk(i: number, current: Settings): Generator<Settings> {
    if (i === controls.length) {
      yield { ...current };
      return;
    }
    const c = controls[i];
    if (!isActive(c, current)) {
      yield* walk(i + 1, { ...current, [c.id]: c.default });
      return;
    }
    const values: (string | number)[] = c.kind === "choice" ? c.options.map((o) => o.value) : numberValues(c, cap);
    for (const v of values) yield* walk(i + 1, { ...current, [c.id]: v });
  }
  yield* walk(0, {});
}

export function gridSize(controls: Control[], cap = MAX_PER_CONTROL): number {
  let n = 0;
  for (const _ of gridSettings(controls, cap)) {
    void _;
    if (++n > MAX_COMBOS * 4) return n;
  }
  return n;
}

export interface Validation {
  ok: boolean;
  reason?: string;
  total: number;
  passing: number;
}
/** a mission is only worth playing if it can be won, is not already won, and is not won by most random settings */
const MAX_PASS_SHARE: Record<Difficulty, number> = { easy: 0.4, medium: 0.25, hard: 0.15 };

export function validateScenario(lab: AnyLab, scenario: unknown, difficulty: Difficulty): Validation {
  const controls = lab.controls(scenario);
  let cap = MAX_PER_CONTROL;
  while (gridSize(controls, cap) > MAX_COMBOS && cap > 3) cap = Math.floor(cap * 0.7);
  let total = 0;
  let passing = 0;
  for (const settings of gridSettings(controls, cap)) {
    total++;
    if (lab.evaluate(scenario, settings).passed) passing++;
  }
  if (passing === 0) return { ok: false, reason: "no settings win", total, passing };
  if (passing / total > MAX_PASS_SHARE[difficulty]) return { ok: false, reason: "too many settings win", total, passing };
  if (lab.evaluate(scenario, defaultSettings(controls)).passed) return { ok: false, reason: "the starting settings already win", total, passing };
  return { ok: true, total, passing };
}

/** The winning settings closest to `current`: fewest controls changed first, then smallest numeric move. Null when nothing wins. */
export function nearestSolution(lab: AnyLab, scenario: unknown, current: Settings): Settings | null {
  const controls = lab.controls(scenario);
  let cap = MAX_PER_CONTROL;
  while (gridSize(controls, cap) > MAX_COMBOS && cap > 3) cap = Math.floor(cap * 0.7);
  let best: Settings | null = null;
  let bestKey: [number, number] = [Infinity, Infinity];
  for (const candidate of gridSettings(controls, cap)) {
    if (!lab.evaluate(scenario, candidate).passed) continue;
    let changed = 0;
    let move = 0;
    for (const c of activeControls(controls, candidate)) {
      if (String(candidate[c.id]) === String(current[c.id])) continue;
      changed++;
      if (c.kind === "number") move += Math.abs(Number(candidate[c.id]) - Number(current[c.id])) / (c.max - c.min || 1);
    }
    if (changed < bestKey[0] || (changed === bestKey[0] && move < bestKey[1])) {
      best = candidate;
      bestKey = [changed, move];
    }
  }
  return best;
}
