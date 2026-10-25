import { Hammer } from "lucide-react";

/** Shown on the Arena home when the student's role has no hands-on tasks yet. Says what is true and what they can do now; promises no date. */
export function RoleBuildingBanner({ careerName }: { careerName: string }) {
  return (
    <section role="status" className="flex items-start gap-3 rounded-2xl border border-[var(--m-rule)] bg-[var(--m-accent-soft)] px-5 py-4">
      <span className="mt-0.5 shrink-0 text-[var(--m-accent)]"><Hammer size={18} aria-hidden /></span>
      <div className="font-lp-body">
        <p className="text-[14.5px] font-bold text-[var(--m-ink)]">We are designing the {careerName} tasks and challenges</p>
        <p className="mt-0.5 text-[13.5px] leading-relaxed text-[var(--m-muted)]">
          We only show real, reviewed work for your role, and nothing from another role. Your skill profile and SkillStudio plan are ready now; hands-on {careerName} tasks will appear here as soon as they are built.
        </p>
      </div>
    </section>
  );
}
