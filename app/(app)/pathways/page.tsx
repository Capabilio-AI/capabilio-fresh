import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { listPathways, loadChosenPathway } from "@/lib/pathways/store";
import { GoalBox } from "@/components/pathways/GoalBox";

export const metadata: Metadata = { title: "Pathways | Capabilio AI" };
const KIND: Record<string, string> = { exam: "Exam route", portfolio: "Portfolio route", credential: "Credential route", venture: "Own venture" };

/** Goals beyond the job-skill careers. Each is a reviewed pathway with sources; nothing unreviewed is listed here. */
export default async function PathwaysPage() {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const [list, chosen] = await Promise.all([listPathways(service), loadChosenPathway(service, user.id)]);
  return (
    <div className="flex flex-col gap-6 pb-16 pt-6">
      <header>
        <h1 className="font-lp-display text-[34px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[46px]">Pathways</h1>
        <p className="mt-2 max-w-[60ch] text-[16px] leading-relaxed text-[var(--m-muted)]">A complete, sourced route for goals that are not a job-skill career: an exam, a design career, a credential, your own venture. Every date and rule links to its official source.</p>
      </header>
      {chosen && <p className="rounded-2xl border border-[var(--m-accent)] bg-[var(--m-accent-soft)] p-4 text-[15px] text-[var(--m-ink)]">Your goal: <Link href={`/pathways/${chosen.key}`} className="font-bold text-[var(--m-accent-ink)]">{chosen.name}</Link></p>}
      <GoalBox />
      {list.length === 0 ? (
        <p className="rounded-2xl border border-[var(--m-rule)] bg-white p-5 text-[15px] text-[var(--m-muted)]">No pathway has been published yet. Each one is written from official sources and reviewed before it appears here.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {list.map((p) => (
            <li key={p.id}>
              <Link href={`/pathways/${p.key}`} className="group flex h-full flex-col gap-2 rounded-2xl border border-[var(--m-rule)] bg-white p-5 transition-colors hover:border-[var(--m-ink)]">
                <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{KIND[p.kind] ?? p.kind}</span>
                <h2 className="font-lp-display text-[24px] font-bold leading-tight text-[var(--m-ink)]">{p.name}</h2>
                <span className="mt-auto inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--m-accent-ink)]">Open the pathway<ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
