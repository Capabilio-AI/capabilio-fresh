import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { listCompanyOpenings } from "@/lib/hiring/openings";
import { JobBoard } from "@/components/jobs/JobBoard";

export const metadata: Metadata = { title: "Jobs — Capabilio AI" };
export const dynamic = "force-dynamic"; // companies open and close roles at any time

export default async function JobsPage() {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const [openings, applied] = await Promise.all([
    listCompanyOpenings(service),
    untyped(service).from("job_applications").select("opening_id").eq("user_id", user.id),
  ]);
  const appliedIds = ((applied.data ?? []) as { opening_id: string | null }[]).map((a) => a.opening_id).filter((id): id is string => Boolean(id));
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight sm:text-[40px]">Jobs</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Roles from companies on Capabilio. Applying shares your Skill Passport with that company, and nothing else.</p>
      <div className="pt-6"><JobBoard openings={openings} appliedIds={appliedIds} /></div>
    </div>
  );
}
