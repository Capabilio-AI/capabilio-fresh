import Link from "next/link";
import { ArrowRight, Swords } from "lucide-react";
import type { NextProof } from "@/lib/languages/next-proof";

/** Arena's door for course work: the next thing to prove in each course the student has started. Stream challenges are separate (Challenges tab). */
export function ProveYourCourses({ items }: { items: NextProof[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="prove-courses-h" className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
      <h2 id="prove-courses-h" className="flex items-center gap-2 font-lp-display text-[22px] font-bold text-white"><Swords size={20} aria-hidden />Prove your courses</h2>
      <p className="mt-1 text-[14px] text-white/70">Finish a step in SkillStudio, then prove it here with code. A step counts as a proven skill only after you pass.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.track}>
            <Link href={i.href} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-[var(--m-ink,#0f2a1d)] transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
              <span className="min-w-0"><span className="block text-[12px] font-bold uppercase tracking-wide opacity-60">{i.trackTitle}{i.kind === "module" ? " · module test" : " · next step"}</span><span className="block truncate text-[15px] font-bold">{i.title}</span></span>
              <ArrowRight size={16} aria-hidden className="shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
