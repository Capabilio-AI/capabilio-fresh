import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getEducationEntries } from "@/lib/dashboard/education";
import { PageHead } from "@/components/dashboard/PageHead";
import { VaultTab } from "@/components/dashboard/VaultTab";
import { EducationHistoryList } from "@/components/education/EducationHistoryList";

export const metadata: Metadata = { title: "Vault History — Capabilio AI" };

export default async function VaultHistoryPage() {
  const { supabase, user } = await requireAuthedUser();
  const entries = await getEducationEntries(supabase, user.id);

  return (
    <div>
      <PageHead title="Vault History" intro="Where you studied and the proof behind it: institutions, certificates, projects, resumes, and links." />

      <div className="flex flex-col gap-10 pt-4">
        <section id="education" aria-labelledby="education-heading" className="scroll-mt-24">
          <h2 id="education-heading" className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">
            Education history
          </h2>
          <p className="mb-4 mt-1 font-lp-body text-[13.5px] text-app-muted">Your institutions, most recent first.</p>
          <EducationHistoryList entries={entries} />
        </section>

        <section id="records" aria-label="Code DNA, certifications, projects and links" className="scroll-mt-24">
          <VaultTab />
        </section>
      </div>
    </div>
  );
}
