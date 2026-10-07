import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Clock, Database, FileText, GraduationCap, type LucideIcon } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { resolveStreamScope } from "@/lib/arena-challenges/resolve-scope";
import { createServiceClient } from "@/lib/supabase/service";
import { getCareerIntent } from "@/lib/careers/intent";
import { ArenaSubNav } from "@/components/arena/ArenaSubNav";

export const metadata: Metadata = {
  title: "Challenges — Arena — Capabilio AI",
  description: "Stream challenges from your branch, and Domain work tickets for your chosen career — two separate tracks.",
};

const ACCENT = {
  orange: { chip: "bg-app-orange-container text-app-orange", badge: "bg-app-orange-container text-app-orange", cta: "bg-app-orange-container text-app-orange group-hover:bg-app-orange group-hover:text-white", ring: "hover:border-app-orange/40" },
  blue: { chip: "bg-app-blue-container text-app-blue", badge: "bg-app-blue-container text-app-blue", cta: "bg-app-blue-container text-app-blue group-hover:bg-app-blue group-hover:text-white", ring: "hover:border-app-blue/40" },
} as const;

export default async function ArenaChallengesPage() {
  const { supabase, user } = await requireAuthedUser();
  const [scope, { intent }] = await Promise.all([resolveStreamScope(supabase, user.id), getCareerIntent(createServiceClient(), user.id)]);
  const target = intent.primary?.name ?? null;

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Arena</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Two separate tracks — pick one. Each has its own leaderboard, streak, and history.</p>
      <div className="mt-4">
        <ArenaSubNav />
      </div>

      <div className="grid grid-cols-1 gap-6 pt-6 lg:grid-cols-2">
        <TrackCard
          href="/arena/challenges/stream"
          icon={GraduationCap}
          accent="orange"
          badge="Stream"
          title="Stream Challenges"
          description={
            scope
              ? "A fresh batch of 8 every Monday, drawn straight from your own branch and subjects. Practice regularly, build subject skills, and get better every week."
              : "Add your branch in Education to unlock a fresh batch of 8 challenges from your own curriculum, every Monday."
          }
          count="8 challenges"
          timing="8–15 min each"
          reward="Earn points"
          context={scope ? { text: `Your stream: ${scope.branch}`, href: "/profile", label: "change" } : { text: "No branch on your profile yet", href: "/profile", label: "Add your branch" }}
        />
        <TrackCard
          href="/arena/challenges/domain"
          icon={Database}
          accent="blue"
          badge="Domain"
          title="Domain Challenges"
          description="Work on real-world tickets for your target career role. Solve problems with industry-style datasets and tools."
          count="8 challenges"
          timing="8–15 min each"
          reward="Earn ELO"
          context={
            target
              ? { text: `Your target: ${target}`, href: "/dashboard/roadmap", label: "change" }
              : { text: intent.isExploring ? "You are still exploring" : "No target career set", href: "/dashboard/roadmap", label: "Set your career" }
          }
        />
      </div>
    </div>
  );
}

function TrackCard({
  href,
  icon: Icon,
  accent,
  badge,
  title,
  description,
  count,
  timing,
  reward,
  context,
}: {
  href: string;
  icon: LucideIcon;
  accent: keyof typeof ACCENT;
  badge: string;
  title: string;
  description: string;
  count: string;
  timing: string;
  reward: string;
  context: { text: string; href: string; label: string };
}) {
  const a = ACCENT[accent];
  return (
    <div className="flex flex-col gap-2.5">
    <Link
      href={href}
      className={`group flex flex-col gap-6 rounded-[28px] border border-app-border bg-white p-8 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_48px_-24px_rgba(0,0,0,0.25)] ${a.ring}`}
    >
      <div className="flex items-start justify-between">
        <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${a.chip}`}>
          <Icon size={26} strokeWidth={1.75} />
        </span>
        <span className={`rounded-full px-3.5 py-1.5 font-lp-mono text-[11px] font-bold uppercase tracking-wider ${a.badge}`}>{badge}</span>
      </div>

      <div>
        <h2 className="font-serif text-[26px] font-bold leading-tight text-app-charcoal">{title}</h2>
        <p className="mt-2.5 font-lp-body text-[14.5px] leading-relaxed text-app-muted">{description}</p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-app-border pt-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-lp-body text-[13px] text-app-muted">
          <span className="flex items-center gap-1.5">
            <FileText size={15} strokeWidth={1.75} />
            {count}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={15} strokeWidth={1.75} />
            {timing}
          </span>
          <span className="flex items-center gap-1.5">
            <BarChart3 size={15} strokeWidth={1.75} />
            {reward}
          </span>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${a.cta}`}>
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
    <p className="px-2 font-lp-body text-[12.5px] text-app-muted">
      {context.text} ·{" "}
      <Link href={context.href} className="font-semibold text-app-charcoal hover:underline">
        {context.label}
      </Link>
    </p>
    </div>
  );
}
