import { activeControls, nearestSolution } from "./grid";
import type { AnyLab, Control, Outcome, Settings } from "./types";

const valueLabel = (c: Control, v: string | number): string => (c.kind === "choice" ? c.options.find((o) => o.value === String(v))?.label ?? String(v) : `${v}${c.unit ? ` ${c.unit}` : ""}`);

/**
 * Three hints, each more direct: (1) a thought about the first objective that fails, (2) which control to look at, (3) the setting to change.
 * Derived from the lab itself, so a hint can never be wrong about the mission it belongs to. Deterministic.
 */
export function hintFor(lab: AnyLab, scenario: unknown, settings: Settings, outcome: Outcome, level: 1 | 2 | 3): string {
  const failing = outcome.objectives.find((o) => !o.ok);
  if (!failing) return "Everything already passes. Run the test to finish the mission.";
  if (level === 1) return failing.nudge;
  const target = nearestSolution(lab, scenario, settings);
  if (!target) return failing.nudge;
  const controls = lab.controls(scenario);
  const differs = activeControls(controls, target).filter((c) => String(target[c.id]) !== String(settings[c.id]));
  if (differs.length === 0) return failing.nudge;
  const first = differs[0];
  if (level === 2) return `Look closely at "${first.label}". It is one of the things holding this back.`;
  return `Change "${first.label}" to ${valueLabel(first, target[first.id])}${differs.length > 1 ? ", then see what else the results ask for" : ""}.`;
}
