/** Where the student is against what the role asks: a filled bar with a tick at the target. Not assessed is shown as exactly that, never as 0. */
export function LevelTrack({ level, target, tone = "light" }: { level: number | null; target: number | null; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  const t = target ?? 100;
  const text = level === null ? "Not assessed yet" : `${level}% now`;
  return (
    <div>
      <div className="relative h-2.5 rounded-full" style={{ background: dark ? "rgb(255 255 255 / 0.16)" : "var(--m-rule)" }} role="img" aria-label={`${text}${target !== null ? `, role asks for ${target}%` : ""}`}>
        {level !== null && <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--m-accent)]" style={{ width: `${Math.min(100, level)}%` }} />}
        {target !== null && <span aria-hidden className="absolute -top-1 bottom-[-4px] w-0.5 rounded-full" style={{ left: `${Math.min(100, t)}%`, background: dark ? "#fff" : "var(--m-ink)" }} />}
      </div>
      <p className="ss-num mt-1.5 flex justify-between text-[12.5px]" style={{ color: dark ? "rgb(255 255 255 / 0.75)" : "var(--m-muted)" }}>
        <span>{text}</span>
        {target !== null && <span>Role asks for {target}%</span>}
      </p>
    </div>
  );
}
