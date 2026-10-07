import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { isPlatformAdmin, listChallenges } from "@/lib/arena-content/store";
import { loadRuntimeAdmin } from "@/lib/arena-content/runtime-admin";
import { RuntimeSettingsPanel } from "@/components/arena/admin/RuntimeSettingsPanel";
import { ArenaChallengesAdmin } from "@/components/arena/admin/ArenaChallengesAdmin";

export const metadata: Metadata = { title: "Arena challenges — Admin — Capabilio AI" };

/** Capabilio admins only; everyone else gets a 404 so the page's existence isn't advertised. */
export default async function ArenaChallengesAdminPage() {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  if (!(await isPlatformAdmin(service, user.id))) notFound();
  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Arena challenges</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Author, validate and publish challenges. Nothing reaches students until it is validated and published.</p>
      <div className="flex flex-col gap-10 pt-6">
        <RuntimeSettingsPanel initial={await loadRuntimeAdmin(service)} />
        <ArenaChallengesAdmin initial={await listChallenges(service)} />
      </div>
    </div>
  );
}
