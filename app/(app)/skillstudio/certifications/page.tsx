import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { AreaHero } from "@/components/metro/AreaHero";
import { CertCards } from "@/components/skillstudio/CertCards";
import { LiveRefresh } from "@/components/dashboard/LiveRefresh";
import { loadCertifications } from "@/lib/skillstudio/certifications";
import { chosenRoleName } from "@/lib/careers/has-role";
import { ProvenSkills } from "@/components/credentials/ProvenSkills";

export const metadata: Metadata = { title: "Certifications | SkillStudio | Capabilio AI" };

export default async function CertificationsPage() {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const sections = await loadCertifications(service, user.id);
  const role = sections.length === 0 ? await chosenRoleName(service, user.id) : null;
  return (
    <div>
      <AreaHero tone="tint" title="Certifications" intro="Credentials on your career roadmap: where to learn, what they cost and what they prove." nav={<SkillStudioSubNav />} />
      <div className="pt-6">
        <LiveRefresh />
        <ProvenSkills userId={user.id} />
        {sections.length > 0 ? <CertCards sections={sections} /> : (
          <p className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center font-lp-body text-[13.5px] text-app-muted">
            {role ? `Certifications for ${role} appear here when they directly build your role's skills. Start with your courses in SkillStudio.` : "Choose a role and the certifications that build its skills appear here."}
          </p>
        )}
      </div>
    </div>
  );
}
