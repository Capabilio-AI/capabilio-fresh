/**
 * The single definition of the 3-2 career-direction trigger (architecture doc §5.4):
 * `end_year − current_calendar_year ≤ 1`. Assessment gating, the goal-state
 * prompt and Launchpad/Interview visibility all call this — never reimplement
 * it inline, or the conditions drift apart. Server-side callers only; client
 * components receive the resulting boolean as a prop.
 */
export const CAREER_DIRECTION_WINDOW_YEARS = 1;

export function isCareerDirectionWindow(endYear: number | null, now: Date = new Date()): boolean {
  if (endYear == null) return false;
  return endYear - now.getFullYear() <= CAREER_DIRECTION_WINDOW_YEARS;
}
