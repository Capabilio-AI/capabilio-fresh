import Link from "next/link";
import { ArrowRight, Check, Lock } from "lucide-react";
import clsx from "clsx";
import type { StudentPhase } from "@/lib/student/phase";

type StepState = "done" | "now" | "locked";
interface Step { title: string; body: string; state: StepState; note?: string }

/** What is open, what is next and when the rest unlocks, for a student who has not chosen a role. Nothing here is a score or a made-up recommendation. */
function stepsFor(phase: Exclude<StudentPhase, "role">): Step[] {
  const choose = phase === "choose";
  return [
    { title: "Common assessment", body: "Where you stand today. Your result is below.", state: "done" },
    { title: "Explore roles", body: "Read what each role needs. No pressure to pick yet.", state: choose ? "done" : "now" },
    { title: "Common challenges", body: "Short practice tasks that build your Skill Passport.", state: phase === "discover" ? "locked" : "now", note: phase === "discover" ? "Opens in 2nd year" : undefined },
    { title: "Choose your role", body: choose ? "Needed now, so Capabilio can build your plan." : "Needed by 3rd year. Earlier is fine too.", state: choose ? "now" : "locked", note: choose ? undefined : "Optional until 3rd year" },
    { title: "Role challenges, SkillStudio and roadmap", body: "Everything built around your role.", state: "locked", note: "Opens when you choose a role" },
    { title: "AI Interview and Launchpad", body: "Mock interviews and job matching.", state: "locked", note: "Opens in final year" },
  ];
}

const HEAD: Record<Exclude<StudentPhase, "role">, { title: string; body: string; cta: string; href: string }> = {
  discover: { title: "You are at the start, and that is fine", body: "Most first-years do not know their role yet. Take a look at what is out there. Your common assessment is already done.", cta: "Explore roles", href: "/explore" },
  practice: { title: "Keep practising, and start narrowing down", body: "Do common challenges to build your Skill Passport. When a role starts to feel right, choose it.", cta: "Explore roles", href: "/explore" },
  choose: { title: "Time to choose your role", body: "From 3rd year your plan, challenges and roadmap are built around a role. Pick one now. You can change it later.", cta: "Choose a role", href: "/explore" },
};

export function YourPathCard({ phase }: { phase: Exclude<StudentPhase, "role"> }) {
  const head = HEAD[phase];
  return (
    <section aria-labelledby="path-h" className="rounded-2xl border border-[var(--m-rule)] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-[58ch]">
          <h2 id="path-h" className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">{head.title}</h2>
          <p className="mt-1 font-lp-body text-[14px] leading-relaxed text-app-muted">{head.body}</p>
        </div>
        <Link href={head.href} className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[14px] font-bold text-white transition-transform hover:-translate-y-0.5 active:scale-[0.97]">
          {head.cta} <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2">
        {stepsFor(phase).map((s) => (
          <li key={s.title} className={clsx("flex gap-3 rounded-xl border p-3", s.state === "now" ? "border-[var(--m-accent)] bg-[var(--m-accent-soft)]" : "border-[var(--m-rule)]", s.state === "locked" && "opacity-70")}>
            <span className={clsx("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", s.state === "done" ? "bg-[var(--m-accent)] text-white" : "bg-[var(--m-ground)] text-[var(--m-muted)]")}>
              {s.state === "done" ? <Check size={14} aria-hidden /> : s.state === "locked" ? <Lock size={12} aria-hidden /> : <ArrowRight size={13} aria-hidden />}
            </span>
            <span className="min-w-0">
              <span className="block font-lp-body text-[14px] font-bold text-[var(--m-ink)]">{s.title}</span>
              <span className="block font-lp-body text-[12.5px] leading-snug text-app-muted">{s.body}</span>
              {s.note && <span className="mt-1 block font-lp-body text-[11.5px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{s.note}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
