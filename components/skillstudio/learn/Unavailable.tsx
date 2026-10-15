import Link from "next/link";
import { Compass, Hammer, TriangleAlert } from "lucide-react";
import type { LearningLoad } from "@/lib/skillstudio/lesson";

type Reason = Extract<LearningLoad, { ok: false }>["reason"];

const COPY: Record<Reason["state"], { icon: typeof Compass; title: (r: Reason) => string; body: string; cta?: { href: string; label: string } }> = {
  NO_CAREER: { icon: Compass, title: () => "Choose your target role to see your courses", body: "Your courses are built from the role you are aiming for and what your assessment finds. Pick a role and they appear here.", cta: { href: "/assessment", label: "Choose your role" } },
  EXPLORING: { icon: Compass, title: () => "Pick a role to see your courses", body: "You are still exploring. Courses are built around one role, so choose the one you want to work towards first.", cta: { href: "/assessment", label: "Choose your role" } },
  NO_PLAN_B: { icon: Compass, title: () => "Choose your target role to see your courses", body: "Your courses follow your main role.", cta: { href: "/assessment", label: "Choose your role" } },
  NO_MEMBERSHIP: { icon: Compass, title: () => "Choose your target role to see your courses", body: "Your courses are built from your role and your assessment.", cta: { href: "/assessment", label: "Choose your role" } },
  NO_TEMPLATE: { icon: Hammer, title: (r) => `The ${"career" in r ? r.career.name : "role"} path is still being built`, body: "We only show courses that are reviewed. Your AI-sequenced plan below works from your skill gaps while this one is prepared." },
  ERROR: { icon: TriangleAlert, title: () => "We couldn't load your courses", body: "Nothing is wrong with your account. Reload the page in a moment.", cta: { href: "/skillstudio", label: "Try again" } },
};

/** Why there is nothing to show, and what to do about it. Never an invented path. */
export function Unavailable({ reason }: { reason: Reason }) {
  const c = COPY[reason.state];
  const Icon = c.icon;
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--m-off)] bg-white px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--m-ground)] text-[var(--m-ink)]"><Icon size={22} aria-hidden /></span>
      <h2 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">{c.title(reason)}</h2>
      <p className="max-w-md text-[14.5px] leading-relaxed text-[var(--m-muted)]">{c.body}</p>
      {c.cta && <Link href={c.cta.href} className="mt-1 inline-flex rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[14px] font-bold text-white">{c.cta.label}</Link>}
    </section>
  );
}
