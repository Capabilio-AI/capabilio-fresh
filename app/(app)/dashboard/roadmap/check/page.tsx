import type { Metadata } from "next";
import Link from "next/link";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getCareerIntent } from "@/lib/careers/intent";
import { chooseDomainCareer } from "@/lib/arena-challenges/career-state";
import { getDiagnostic } from "@/lib/roadmap-visual/diagnostic-store";
import { DiagnosticRunner } from "@/components/roadmap/visual/DiagnosticRunner";

export const metadata: Metadata = { title: "Baseline check — Capabilio AI" };

export default async function CheckPage({ searchParams }: { searchParams: Promise<{ career?: string }> }) {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const career = (await searchParams).career === "plan-b" ? "plan-b" : "primary";
  const { intent } = await getCareerIntent(service, user.id);
  const chosen = chooseDomainCareer(intent, career);
  const initial = await getDiagnostic(service, user.id, chosen.state === "ready" ? chosen.career.id : null);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/roadmap" className="font-lp-body text-[13px] text-app-blue hover:underline">← Roadmap</Link>
      <h1 className="mt-2 font-lp-display text-[24px] font-semibold text-app-charcoal">Baseline check{chosen.state === "ready" ? `: ${chosen.career.name}` : ""}</h1>
      <div className="mt-4"><DiagnosticRunner initial={initial} career={career} /></div>
    </div>
  );
}
