import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getEducationEntries } from "@/lib/dashboard/education";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { VaultTab } from "@/components/dashboard/VaultTab";
import { EducationHistoryList } from "@/components/education/EducationHistoryList";

export const metadata: Metadata = { title: "Vault History — Capabilio AI" };

export default async function VaultHistoryPage() {
  const { supabase, user } = await requireAuthedUser();
  const entries = await getEducationEntries(supabase, user.id);

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Vault History</h1>
      <p className="mt-1 max-w-2xl font-lp-body text-[13px] text-app-muted">
        Where you studied and the proof behind it — institutions, certificates, projects, resumes, and links.
      </p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>

      <div className="flex flex-col gap-10 pt-6">
        <section id="education" aria-labelledby="education-heading" className="scroll-mt-24">
          <h2 id="education-heading" className="font-lp-display text-[17px] font-semibold text-app-charcoal">
            Educational history
          </h2>
          <p className="mb-4 mt-1 font-lp-body text-[12.5px] text-app-muted">Your institutions, most recent first.</p>
          <EducationHistoryList entries={entries} />
        </section>

        <section id="vault" aria-labelledby="vault-heading" className="scroll-mt-24">
          <h2 id="vault-heading" className="font-lp-display text-[17px] font-semibold text-app-charcoal">
            Vault
          </h2>
          <p className="mb-4 mt-1 font-lp-body text-[12.5px] text-app-muted">
            Your private evidence store. Portfolio entries are built from what you verify here.
          </p>
          <VaultTab />
        </section>
      </div>
    </div>
  );
}
