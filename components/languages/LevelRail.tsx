import Link from "next/link";
import { ArrowRight, Award, Check, Lock } from "lucide-react";
import clsx from "clsx";
import { examArea, hasArenaExam, type LevelRow } from "@/lib/languages/levels";

const YEAR = ["1st year", "2nd year", "3rd year", "Final year"];
const EXAM_SIZE = [4, 4, 4, 8];

/**
 * The four levels of a language, one per year: what each holds, where the student stands, and the way on. A level is proven by its modules and, where the language has
 * one, its year exam; the certificate comes when all four are proven.
 */
export function LevelRail({ trackKey, courseTitle, rows }: { trackKey: string; courseTitle: string; rows: LevelRow[] }) {
  const all = rows.every((r) => r.status === "proven");
  return (
    <section aria-labelledby="levels-h" className="mt-8 rounded-3xl border border-[var(--m-rule)] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="levels-h" className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">Your {courseTitle} path</h2>
          <p className="mt-0.5 max-w-[62ch] text-[14px] text-[var(--m-muted)]">Four levels, one for each year of study. Prove every module of a level{hasArenaExam(trackKey) ? " and pass its year exam" : ""} to open the next level. Prove all four to earn the Capabilio Certificate.</p>
        </div>
        {all && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f5ee] px-3 py-1.5 text-[13px] font-bold text-[#0f5132]"><Award size={14} aria-hidden />All four levels proven</span>}
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((r) => (
          <li key={r.n} className={clsx("flex flex-col gap-2 rounded-2xl border p-4", r.status === "proven" ? "border-[#17784a] bg-[#e8f5ee]" : r.status === "locked" ? "border-[var(--m-rule)] bg-[var(--m-ground)] text-[var(--m-muted)]" : "border-[var(--m-ink)] bg-white")}>
            <p className="flex items-center justify-between text-[12px] font-bold uppercase tracking-wide opacity-70"><span>{YEAR[r.n - 1]}</span><span>Level {r.n}</span></p>
            <p className="font-lp-display text-[19px] font-bold leading-tight text-[var(--m-ink)]">{r.label}</p>
            <p className="ss-num text-[13px]">{r.modulesProven} of {r.modules.length} {r.modules.length === 1 ? "module" : "modules"} proven</p>
            {r.status === "proven" && <p className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[#0f5132]"><Check size={14} aria-hidden />Badge earned</p>}
            {r.status === "locked" && <p className="inline-flex items-center gap-1.5 text-[13px]"><Lock size={13} aria-hidden />Opens when Level {r.n - 1} is proven</p>}
            {r.status === "learning" && <p className="text-[13px] text-[var(--m-ink)]">{hasArenaExam(trackKey) ? `Prove its modules, then take the ${EXAM_SIZE[r.n - 1]}-problem exam.` : "Prove its modules to earn the badge."}</p>}
            {r.status === "exam" && (
              <Link href={`/skillstudio/courses/proof?area=${examArea(trackKey)}&tier=${r.n}`} className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--m-ink)] px-4 py-2 text-[13.5px] font-bold text-white">Take the {r.label} exam<ArrowRight size={14} aria-hidden /></Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
