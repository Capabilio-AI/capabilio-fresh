import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getEducationEntries } from "@/lib/dashboard/education";
import { PageHead } from "@/components/dashboard/PageHead";
import { VaultTab } from "@/components/dashboard/VaultTab";
import { EducationHistoryList } from "@/components/education/EducationHistoryList";
import { EmploymentSection } from "@/components/vault/EmploymentSection";
import { getStageState } from "@/lib/stage/server";

export const metadata: Metadata = { title: "Vault History — Capabilio AI" };

export default async function VaultHistoryPage() {
  const { supabase, user } = await requireAuthedUser();
  const [entries, { stage }] = await Promise.all([getEducationEntries(supabase, user.id), getStageState(user.id)]);

  return (
    <div>
      <PageHead title="Vault History" intro={stage === "student" ? "Where you studied and the proof behind it: institutions, certificates, projects, and links." : "Where you studied and worked, and the proof behind it. Everything you added as a student stays here."} />

      <div className="flex flex-col gap-10 pt-4">
        <section id="education" aria-labelledby="education-heading" className="scroll-mt-24">
          <h2 id="education-heading" className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">
            Education history
          </h2>
          <p className="mb-4 mt-1 font-lp-body text-[13.5px] text-app-muted">Your institutions, most recent first.</p>
          <EducationHistoryList entries={entries} />
        </section>

        {stage !== "student" && <EmploymentSection userId={user.id} movesPath={stage === "graduate"} />}

        <section id="records" aria-label="Code DNA, certifications, projects and links" className="scroll-mt-24">
          <VaultTab />
        </section>
      </div>
    </div>
  );
}
