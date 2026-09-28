import { weeksBetween } from "./week";

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastCompletedWeek: string | null;
}

/**
 * Pure. A student's streak advances at most once per week, regardless of
 * how many challenges they finish that week — completing 5 tasks Monday
 * and 3 more Thursday is still one week of the streak, not two.
 */
export function advanceStreak(state: StreakState, currentWeek: string): StreakState {
  if (state.lastCompletedWeek === currentWeek) return state;

  const isConsecutive = state.lastCompletedWeek !== null && weeksBetween(state.lastCompletedWeek, currentWeek) === 1;
  const nextStreak = isConsecutive ? state.currentStreak + 1 : 1;

  return {
    currentStreak: nextStreak,
    longestStreak: Math.max(state.longestStreak, nextStreak),
    lastCompletedWeek: currentWeek,
  };
}
