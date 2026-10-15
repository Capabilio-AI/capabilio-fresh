import Link from "next/link";
import { ArrowRight, Briefcase, FolderOpen, IdCard, MessagesSquare, Activity } from "lucide-react";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import type { ProfessionalHomeData } from "@/lib/stage/professional";

const CARD = "group flex flex-col gap-2 rounded-2xl border border-[var(--m-rule)] bg-white p-5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--m-ink)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** The professional path's home: lean on purpose. Their evidence came with them; the full path is built later. */
export function ProfessionalHome({ data, employerName, jobTitle }: { data: ProfessionalHomeData; employerName: string | null; jobTitle: string | null }) {
  const role = [jobTitle, employerName].filter(Boolean).join(" at ");
  const tiles = [
    { href: "/dashboard/passport", icon: IdCard, title: "Skill Passport", body: "Your verified skill badges, ready to share." },
    { href: "/dashboard/portfolio", icon: FolderOpen, title: "Portfolio", body: "Your projects and proof, ready to share." },
    { href: "/dashboard/vault", icon: Briefcase, title: "Evidence vault", body: `${data.proofCount} ${data.proofCount === 1 ? "item" : "items"} of verified evidence.` },
    { href: "/dashboard/interview", icon: MessagesSquare, title: "AI Interview", body: "Keep your interview skills sharp for the next move." },
    { href: "/pulse", icon: Activity, title: "Pulse", body: "Your community and conversations." },
  ];
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="pro-h" className="relative overflow-hidden rounded-3xl bg-[var(--m-ink)] p-6 text-white sm:p-8">
        <span aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[var(--m-accent)] opacity-25 blur-3xl" />
        <p className="relative font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-white/60">Working professional</p>
        <h1 id="pro-h" className="relative mt-2 font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight sm:text-[40px]">
          {data.firstName ? `Congratulations, ${data.firstName}.` : "Congratulations."}
        </h1>
        <p className="relative mt-2 max-w-xl text-[14.5px] leading-relaxed text-white/70">
          {role ? `You are now ${role}. ` : "You have a job. "}Everything you proved on the way here stays on your profile.
          {data.overview ? ` Verified level: ${data.overview.tier.label}, ${data.overview.elo} ELO for ${data.overview.roleName}.` : ""}
        </p>
      </section>
      <DashboardSubNav />
      <ul className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className={CARD}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--m-ground)] text-[var(--m-ink)]"><t.icon size={18} aria-hidden /></span>
              <span className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">{t.title}</span>
              <span className="text-[13.5px] text-app-muted">{t.body}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold text-[var(--m-ink)]">Open <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
