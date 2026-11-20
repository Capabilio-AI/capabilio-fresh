// A two-stage spur gear train in line: gear 1 (input) drives gear 2, gear 3 sits on gear 2's shaft and drives gear 4 (output).
// Lewis bending strength with a 1.5 safety factor, 96-97% efficiency per stage. Pure and deterministic.

export const MODULES = [1.5, 2, 2.5, 3];
export const TEETH_MIN = 17; // fewer teeth undercut the tooth root
export const TEETH_MAX = 90;
const ALLOWABLE_MPA = 120;
const FACE_WIDTH_MODULES = 10;
const SAFETY = 1.5;
const EFFICIENCY = 0.97;

export interface GearInput { teeth: [number, number, number, number]; module: number; inRpm: number; outTorqueNm: number }
export interface GearResult {
  ratio: number;
  outRpm: number;
  undercut: boolean;
  /** tangential force each stage's pinion must carry and may carry, newtons */
  need: [number, number];
  allow: [number, number];
  strongEnough: [boolean, boolean];
  centreMm: [number, number];
  widthMm: number;
  pitchMm: [number, number, number, number];
}

const lewisY = (z: number) => 0.154 - 0.912 / z;
const allowedForce = (z: number, m: number) => ALLOWABLE_MPA * (FACE_WIDTH_MODULES * m) * m * lewisY(z);

export function analyseGears(g: GearInput): GearResult {
  const [z1, z2, z3, z4] = g.teeth;
  const m = g.module;
  const ratio = (z2 / z1) * (z4 / z3);
  const needStage2 = (2 * g.outTorqueNm * 1000) / (m * z4);
  const midTorque = g.outTorqueNm / (z4 / z3) / EFFICIENCY;
  const needStage1 = (2 * midTorque * 1000) / (m * z2);
  const allow: [number, number] = [allowedForce(z1, m), allowedForce(z3, m)];
  const need: [number, number] = [needStage1, needStage2];
  const centre: [number, number] = [(m * (z1 + z2)) / 2, (m * (z3 + z4)) / 2];
  return {
    ratio,
    outRpm: g.inRpm / ratio,
    undercut: g.teeth.some((z) => z < TEETH_MIN),
    need,
    allow,
    strongEnough: [allow[0] >= need[0] * SAFETY, allow[1] >= need[1] * SAFETY],
    centreMm: centre,
    widthMm: centre[0] + centre[1],
    pitchMm: g.teeth.map((z) => m * z) as [number, number, number, number],
  };
}

export const speedOk = (outRpm: number, targetRpm: number, tolerance: number): boolean => Math.abs(outRpm - targetRpm) / targetRpm <= tolerance;

/** The narrowest train that meets speed and strength, found by search; null when none exists. Used to prove a scenario is winnable and to set its width budget. */
export function narrowest(inRpm: number, targetRpm: number, tolerance: number, outTorqueNm: number): { teeth: [number, number, number, number]; module: number; widthMm: number } | null {
  const ratio = inRpm / targetRpm;
  let best: { teeth: [number, number, number, number]; module: number; widthMm: number } | null = null;
  for (const mod of MODULES) {
    for (let z1 = TEETH_MIN; z1 <= 40; z1++) {
      for (let z3 = TEETH_MIN; z3 <= 40; z3++) {
        for (let z2 = TEETH_MIN; z2 <= TEETH_MAX; z2++) {
          for (const z4 of [Math.floor((ratio * z1 * z3) / z2), Math.ceil((ratio * z1 * z3) / z2)]) {
            if (z4 < TEETH_MIN || z4 > TEETH_MAX) continue;
            const teeth: [number, number, number, number] = [z1, z2, z3, z4];
            const r = analyseGears({ teeth, module: mod, inRpm, outTorqueNm });
            if (!r.undercut && speedOk(r.outRpm, targetRpm, tolerance) && r.strongEnough[0] && r.strongEnough[1] && (!best || r.widthMm < best.widthMm)) best = { teeth, module: mod, widthMm: r.widthMm };
          }
        }
      }
    }
  }
  return best;
}
