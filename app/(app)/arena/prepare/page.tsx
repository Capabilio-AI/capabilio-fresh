import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { listOpenOpportunities } from "@/lib/launchpad/opportunities";
import { loadPreparation } from "@/lib/launchpad/prepare-server";
import { PrepareForm } from "@/components/arena/prepare/PrepareForm";

export const metadata: Metadata = { title: "Prepare for a job — Arena — Capabilio AI" };

export default async function PreparePage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { supabase, user } = await requireAuthedUser();
  const { job } = await searchParams;

  let initial = null;
  let notFound = false;
  if (job) {
    const id = z.string().uuid().safeParse(job);
    const opportunity = id.success ? (await listOpenOpportunities(supabase, new Date(), id.data))[0] : undefined;
    if (opportunity) initial = await loadPreparation(createServiceClient(), user.id, { title: `${opportunity.role}, ${opportunity.company}`, skills: opportunity.skills });
    else notFound = true;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/arena" className="inline-flex items-center gap-1.5 font-lp-body text-[13px] font-semibold text-[var(--m-muted)] hover:text-[var(--m-ink)]"><ArrowLeft size={14} aria-hidden /> Arena</Link>
        <h1 className="mt-3 font-lp-display text-[32px] font-bold leading-tight tracking-tight text-[var(--m-ink)] sm:text-[40px]">Prepare for a specific job</h1>
        <p className="mt-1 max-w-2xl font-lp-body text-[14px] leading-relaxed text-app-muted">Practise for the job you actually want, not for the role in general. Each plan is built from your own measured skills.</p>
      </div>
      <PrepareForm initial={initial} notFound={notFound} />
    </div>
  );
}
