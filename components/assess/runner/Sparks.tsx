const COLORS = ["var(--ok)", "var(--m-accent)", "var(--hue-b)", "var(--hue-a)"];

/** A short burst for a correct answer. Pure CSS, positions fixed by index (no randomness, so it renders the same on server and client). */
export function Sparks() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const r = 34 + (i % 3) * 10;
        return <span key={i} className="a-spark" style={{ background: COLORS[i % COLORS.length], ["--dx" as string]: `${Math.cos(angle) * r}px`, ["--dy" as string]: `${Math.sin(angle) * r}px` }} />;
      })}
    </span>
  );
}
