/** A grease-pencil mark drawn over the page: a loose circle or an underline. Decorative, so hidden from assistive tech. */
export default function PencilMark({ kind, className = "", delay = "0.9s" }: { kind: "circle" | "underline"; className?: string; delay?: string }) {
  const style = { "--d": delay, "--len": kind === "circle" ? 520 : 260 } as React.CSSProperties;
  return kind === "circle" ? (
    <svg aria-hidden="true" viewBox="0 0 200 80" preserveAspectRatio="none" className={`pointer-events-none absolute ${className}`}>
      <path className="crit-mark crit-mark-draw" style={style} d="M30 14C70 -2 150 2 183 26c16 14 4 40-30 48-48 10-120 6-146-14C-8 38 12 18 58 10" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 200 14" preserveAspectRatio="none" className={`pointer-events-none absolute ${className}`}>
      <path className="crit-mark crit-mark-draw" style={style} d="M3 8C40 3 80 11 120 6s60 4 77 1" />
    </svg>
  );
}
