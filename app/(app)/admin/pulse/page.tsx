import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { isPlatformAdmin } from "@/lib/arena-content/store";
import { listApplications } from "@/lib/pulse/mentors";
import { loadReports } from "@/lib/pulse/moderation";
import { PulseAdminPanel } from "@/components/pulse/PulseAdminPanel";

export const metadata: Metadata = { title: "Pulse moderation — Admin — Capabilio AI" };

/** Capabilio admins only; everyone else gets a 404 so the page's existence isn't advertised. */
export default async function PulseAdminPage() {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  if (!(await isPlatformAdmin(service, user.id))) notFound();
  const [applications, reports] = await Promise.all([listApplications(service, "pending"), loadReports(service, "open")]);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Pulse moderation</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Approve mentors and handle reports from Pulse. Nothing about a mentor is public until you approve it.</p>
      <div className="pt-6"><PulseAdminPanel applications={applications} reports={reports} /></div>
    </div>
  );
}
