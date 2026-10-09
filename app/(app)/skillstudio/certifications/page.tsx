import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { AreaHero } from "@/components/metro/AreaHero";
import { CertCards } from "@/components/skillstudio/CertCards";
import { LiveRefresh } from "@/components/dashboard/LiveRefresh";
import { loadCertifications } from "@/lib/skillstudio/certifications";

export const metadata: Metadata = { title: "Certifications | SkillStudio | Capabilio AI" };

export default async function CertificationsPage() {
  const { user } = await requireAuthedUser();
  const sections = await loadCertifications(createServiceClient(), user.id);
  return (
    <div>
      <AreaHero tone="tint" title="Certifications" intro="Credentials on your career roadmap: where to learn, what they cost and what they prove." nav={<SkillStudioSubNav />} />
      <div className="pt-6">
        <LiveRefresh />
        {sections.length > 0 ? <CertCards sections={sections} /> : (
          <p className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center font-lp-body text-[13.5px] text-app-muted">No certifications are on your career roadmap yet. Choose a career direction and they appear here.</p>
        )}
      </div>
    </div>
  );
}
