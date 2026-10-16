const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September"];
const pad = (n: number) => String(n).padStart(2, "0");

export interface Window {
  label: string;
  /** inclusive start, exclusive end, as ISO dates */
  start: string;
  end: string;
}

/** month is 1-9 (the warehouse covers January to September 2026) */
export function monthWindow(month: number): Window {
  return { label: `${MONTH_NAMES[month - 1]} 2026`, start: `2026-${pad(month)}-01`, end: month === 12 ? "2027-01-01" : `2026-${pad(month + 1)}-01` };
}

/** quarter is 1-3 */
export function quarterWindow(quarter: number): Window {
  const first = (quarter - 1) * 3 + 1;
  return { label: `Q${quarter} 2026`, start: `2026-${pad(first)}-01`, end: `2026-${pad(first + 3)}-01` };
}

export const monthName = (month: number) => MONTH_NAMES[month - 1];
