import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { isPlatformAdmin } from "@/lib/arena-content/store";
import { listTemplates } from "@/lib/roadmap-visual/template-store";
import { RoadmapTemplatesAdmin } from "@/components/roadmap/admin/RoadmapTemplatesAdmin";

export const metadata: Metadata = { title: "Roadmap templates — Admin — Capabilio AI" };

/** Capabilio admins only; everyone else gets a 404. */
export default async function RoadmapTemplatesAdminPage() {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  if (!(await isPlatformAdmin(service, user.id))) notFound();
  return (
    <div>
      <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">Roadmap templates</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Topic trees for each career. A tree reaches students only after it is reviewed and published; every topic must use an active skill from the taxonomy.</p>
      <div className="pt-6"><RoadmapTemplatesAdmin initial={await listTemplates(service)} /></div>
    </div>
  );
}
