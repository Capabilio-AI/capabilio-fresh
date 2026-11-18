import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

/**
 * Shown where a student's skill graph and skill gap analysis would be, before they have taken a role assessment. It points to what they can do now
 * (learn in SkillStudio) and says when the rest arrives, instead of sending them to an assessment they are not meant to take yet.
 */
export function RoleAssessmentPending({ roleName }: { roleName?: string | null }) {
  return (
    <section className="rounded-2xl border border-[var(--m-rule)] bg-white p-6 sm:p-8" aria-labelledby="pending-h">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--m-ground)] text-[var(--m-ink)]"><BookOpen size={20} aria-hidden /></span>
      <h2 id="pending-h" className="mt-4 font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Learn first, then see where you stand</h2>
      <p className="mt-2 max-w-[62ch] font-lp-body text-[14.5px] leading-relaxed text-app-muted">
        Your skill graph and skill gap analysis are built from your role assessment. You take it in 3rd year, when we ask whether you want to continue with {roleName ? `${roleName}` : "your role"} or switch to another.
        Until then, learn the skills of your role in SkillStudio.
      </p>
      <Link href="/skillstudio" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[14px] font-bold text-white transition-transform hover:-translate-y-0.5 active:scale-[0.97]">
        Open SkillStudio <ArrowRight size={16} aria-hidden />
      </Link>
    </section>
  );
}
