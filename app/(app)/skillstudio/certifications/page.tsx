import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { matchCareersForStudent } from "@/lib/career/match";
import { createServiceClient } from "@/lib/supabase/service";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { AreaHero } from "@/components/metro/AreaHero";
import { MOCK_CERTIFICATIONS } from "@/lib/mock/skillstudio";
import { CatalogGrid } from "@/components/skillstudio/CatalogGrid";
import { loadCareerResources } from "@/lib/roadmap-visual/career-resources";
import { ResourceGallery } from "@/components/roadmap/visual/ResourceGallery";

export const metadata: Metadata = { title: "Certifications | SkillStudio | Capabilio AI" };

export default async function CertificationsPage() {
  const { supabase, user } = await requireAuthedUser();
  const [careerMatches, careers] = await Promise.all([matchCareersForStudent(supabase, user.id), loadCareerResources(createServiceClient(), user.id)]);
  const gapSkills = new Set((careerMatches[0]?.skillGaps ?? []).filter((g) => g.gap > 0).map((g) => g.skill));
  const forCareer = careers.filter((c) => c.certifications.length > 0);

  return (
    <div>
      <AreaHero tone="tint" title="Certifications" intro="Credentials that prove your skills, starting with the ones on your career roadmap." nav={<SkillStudioSubNav />} />
      <div className="flex flex-col gap-10 pt-6">
        {forCareer.map((c) => (
          <section key={c.which} aria-labelledby={`cert-${c.which}`}>
            <h2 id={`cert-${c.which}`} className="mb-1 font-lp-display text-[24px] font-bold text-[var(--m-ink)]">{c.which === "primary" ? `For ${c.careerName}` : `For ${c.careerName} (Plan B)`}</h2>
            <p className="mb-4 font-lp-body text-[14px] text-app-muted">From your roadmap. Open one for what it covers and how to earn it.</p>
            <ResourceGallery resources={c.certifications} career={c.which} emptyText="No certifications yet." />
          </section>
        ))}
        <section aria-labelledby="cert-more">
          <h2 id="cert-more" className="mb-4 font-lp-display text-[24px] font-bold text-[var(--m-ink)]">{forCareer.length > 0 ? "More certifications" : "All certifications"}</h2>
          <CatalogGrid items={MOCK_CERTIFICATIONS.map((c) => ({ id: c.id, title: c.title, level: c.level, skills: c.skills, meta: c.issuer, matchesGap: c.skills.some((s) => gapSkills.has(s)) }))} />
        </section>
      </div>
    </div>
  );
}
