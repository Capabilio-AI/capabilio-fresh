const MAX_LEVEL = 4;
const LEVEL_OPACITY = [0.1, 0.32, 0.55, 0.78, 1];
const DAY_MS = 86_400_000;

/** Pure -- 0 for no activity, 1-4 scaled to this profile's own busiest day. */
export function heatLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(MAX_LEVEL, Math.ceil((count / max) * MAX_LEVEL));
}

/**
 * A year of contribution days as a GitHub-style grid. Colour comes from the
 * parent's text colour (cells use currentColor + opacity), so the same
 * component fits the dashboard and the portfolio themes.
 */
export function ContributionHeatmap({ calendar: fullCalendar, calendarStart, recentWeeks, className = "" }: { calendar: number[]; calendarStart: string; recentWeeks?: number; className?: string }) {
  if (fullCalendar.length === 0) return null;
  // `recentWeeks` trims to the latest N weeks for narrow spaces (the portfolio sidebar).
  const offset = recentWeeks ? Math.max(0, fullCalendar.length - recentWeeks * 7) : 0;
  const calendar = fullCalendar.slice(offset);
  const max = Math.max(...calendar);
  const start = new Date(new Date(`${calendarStart}T00:00:00Z`).getTime() + offset * DAY_MS);
  const weeks = Math.ceil((start.getUTCDay() + calendar.length) / 7);
  const total = calendar.reduce((sum, n) => sum + n, 0);

  return (
    <div className="overflow-x-auto">
      <div
        role="img"
        aria-label={`Contribution activity: ${total} contributions`}
        className={`grid ${recentWeeks ? "" : "min-w-[560px]"} grid-flow-col grid-rows-7 gap-[3px] ${className}`}
        style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {calendar.map((count, i) => {
          const date = new Date(start.getTime() + i * DAY_MS);
          return (
            <span
              key={i}
              title={`${count} contribution${count === 1 ? "" : "s"} on ${date.toISOString().slice(0, 10)}`}
              className="aspect-square rounded-[2px] bg-current"
              style={{ opacity: LEVEL_OPACITY[heatLevel(count, max)], ...(i === 0 ? { gridRowStart: start.getUTCDay() + 1 } : {}) }}
            />
          );
        })}
      </div>
    </div>
  );
}
