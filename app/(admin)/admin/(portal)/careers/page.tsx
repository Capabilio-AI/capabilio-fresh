import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { isPlatformAdmin } from "@/lib/arena-content/store";
import { listAllOpenings, listApplications } from "@/lib/hiring/openings";
import { CareersAdmin } from "@/components/careers/CareersAdmin";

export const metadata: Metadata = { title: "Careers — Admin — Capabilio AI" };

/** Capabilio admins only; everyone else gets a 404 so the page's existence isn't advertised. */
export default async function CareersAdminPage() {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  if (!(await isPlatformAdmin(service, user.id))) notFound();
  const [openings, applications] = await Promise.all([listAllOpenings(service), listApplications(service)]);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">Careers</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Post a role and it appears on /careers the moment its status is Open. No deploy needed.</p>
      <div className="pt-6"><CareersAdmin openings={openings} applications={applications} /></div>
    </div>
  );
}
