import type { Metadata } from "next";
import { archivo } from "@/components/careers/fonts";
import "@/components/careers/careers.css";
import CareersHeader from "@/components/careers/CareersHeader";
import CareersFooter from "@/components/careers/CareersFooter";
import CareersHero from "@/components/careers/CareersHero";
import Mission from "@/components/careers/Mission";
import Teams from "@/components/careers/Teams";
import Faq from "@/components/careers/Faq";
import HowWeHire from "@/components/careers/HowWeHire";
import Beliefs from "@/components/careers/Beliefs";
import RoleBoard from "@/components/careers/RoleBoard";
import OpenIntro from "@/components/careers/OpenIntro";
import { createServiceClient } from "@/lib/supabase/service";
import { listPublicOpenings } from "@/lib/hiring/openings";

export const dynamic = "force-dynamic"; // roles are posted from the admin page and must show at once

export const metadata: Metadata = {
  title: "Careers — Capabilio AI",
  description: "Capabilio hires on proof. See open roles, or show us something you built, solved or shipped.",
};

export default async function CareersPage() {
  const openings = await listPublicOpenings(createServiceClient());
  return (
    <div className={`${archivo.variable} crit min-h-screen`}>
      <CareersHeader />
      <main>
        <CareersHero openCount={openings.filter((o) => o.status === "open").length} />
        <Mission />
        <section id="roles" className="scroll-mt-14 px-5 py-24 md:px-10 md:py-32">
          <div className="mx-auto max-w-[84rem]">
            <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
              <h2 className="crit-head text-[clamp(2rem,4.6vw,3.6rem)]">
                Open roles
              </h2>
              {openings.length > 0 && <span className="font-mono text-sm text-[var(--crit-soft)]">{openings.length}</span>}
            </div>
            <RoleBoard openings={openings} />
          </div>
        </section>
        <Teams openings={openings} />
        <HowWeHire />
        <Beliefs />
        <Faq />
        <OpenIntro />
      </main>
      <CareersFooter />
    </div>
  );
}
