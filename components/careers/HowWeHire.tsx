import { HIRING_STEPS } from "@/lib/hiring/content";
import PencilMark from "./PencilMark";

// Each sheet hangs a little differently, the way work does on a real wall.
const HANG = [
  { r: "-1.6deg", top: "0rem" },
  { r: "1.2deg", top: "2.5rem" },
  { r: "-0.8deg", top: "0.75rem" },
  { r: "1.8deg", top: "3.25rem" },
] as const;

export default function HowWeHire() {
  return (
    <section id="process" className="scroll-mt-14 border-t-[3px] border-[var(--crit-ink)]! px-5 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-[84rem]">
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <h2 className="crit-head text-[clamp(2rem,4.6vw,3.6rem)]">Hiring, the way we would want to be hired.</h2>
          <p className="crit-body max-w-md text-lg leading-relaxed text-[var(--crit-soft)]">Four steps. You always know which one you are in and what comes next.</p>
        </div>

        <ol className="mt-20 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
          {HIRING_STEPS.map((s, i) => (
            <li key={s.title} className="crit-sheet single crit-tilt p-6 pb-8 lg:[margin-top:var(--top)]" style={{ "--r": HANG[i].r, "--top": HANG[i].top } as React.CSSProperties}>
              <span className="relative mb-5 grid h-12 w-12 place-items-center text-2xl font-extrabold text-[var(--crit-pencil)]" style={{ fontStretch: "118%" }}>
                {i + 1}
                <PencilMark kind="circle" className="-inset-1 h-[calc(100%+0.5rem)] w-[calc(100%+0.5rem)]" delay="0s" />
              </span>
              <h3 className="crit-head text-[1.6rem]">{s.title}</h3>
              <p className="crit-body mt-3 text-[0.95rem] leading-relaxed text-[var(--crit-soft)]">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
