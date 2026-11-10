/** Pure. A yearly rupee amount as lakhs per annum, the way Indian job posts quote pay: 420000 -> "₹4.2 LPA". */
export function formatLpa(rupees: number): string {
  const lakhs = rupees / 100_000;
  return `₹${lakhs >= 10 ? Math.round(lakhs) : Number(lakhs.toFixed(1))} LPA`;
}

/** Pure. A posting's stated pay as a short range, or null when it gave none. */
export function formatJobPay(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const lo = min ?? max!;
  const hi = max ?? min!;
  return Math.round(lo / 1e4) === Math.round(hi / 1e4) ? formatLpa(lo) : `${formatLpa(lo)} – ${formatLpa(hi)}`;
}
