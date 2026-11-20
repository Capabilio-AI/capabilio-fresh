// IEC 60255 standard-inverse overcurrent relay: t = TMS · 0.14 / ((I / Ip)^0.02 − 1). Pure; shared by the grader and the diagram's live curves.

export const PICKUP_A = [20, 30, 40, 60, 80, 100, 125, 160, 200, 250, 320, 400, 500, 630, 800];
export const TMS_VALUES = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.7, 1];
const PICKS_UP_ABOVE = 1.05;

/** Operating time in seconds; Infinity when the current is too low for the relay to pick up. */
export function opTime(currentA: number, pickupA: number, tms: number): number {
  const m = currentA / pickupA;
  return m <= PICKS_UP_ABOVE ? Infinity : (tms * 0.14) / (m ** 0.02 - 1);
}

/** Points of one relay's curve on log-log axes between two currents, clipped to a readable time window. */
export function curvePoints(pickupA: number, tms: number, fromA: number, toA: number, steps = 48): { i: number; t: number }[] {
  const pts: { i: number; t: number }[] = [];
  for (let k = 0; k <= steps; k++) {
    const i = 10 ** (Math.log10(fromA) + ((Math.log10(toA) - Math.log10(fromA)) * k) / steps);
    const t = opTime(i, pickupA, tms);
    if (Number.isFinite(t)) pts.push({ i, t: Math.min(100, Math.max(0.02, t)) });
  }
  return pts;
}
