import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { archivo } from "@/components/careers/fonts";
import "@/components/careers/careers.css";
import CareersHeader from "@/components/careers/CareersHeader";
import CareersFooter from "@/components/careers/CareersFooter";
import RoleDetail from "@/components/careers/RoleDetail";
import { createServiceClient } from "@/lib/supabase/service";
import { getPublicOpening, listPublicOpenings } from "@/lib/hiring/openings";
import { isAccepting, jobPostingJsonLd, safeJsonLd } from "@/lib/hiring/format";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://capabilio.online";

// generateMetadata and the page both need this row; cache() makes it one query per request.
const load = cache((slug: string) => getPublicOpening(createServiceClient(), slug));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const o = await load((await params).slug);
  if (!o) return { title: "Careers — Capabilio AI", robots: { index: false } };
  return {
    title: `${o.title} — Careers — Capabilio AI`,
    description: o.summary,
    // a closed role keeps working for anyone holding the link, but search should not keep sending people to it
    robots: isAccepting(o) ? undefined : { index: false, follow: true },
  };
}

export default async function RolePage({ params }: { params: Promise<{ slug: string }> }) {
  const opening = await load((await params).slug);
  if (!opening) notFound();
  const accepting = isAccepting(opening);
  // other roles on the page: same team first, otherwise whatever else is listed
  const all = (await listPublicOpenings(createServiceClient())).filter((r) => r.id !== opening.id);
  const sameTeam = all.filter((r) => r.team === opening.team);
  const others = (sameTeam.length > 0 ? sameTeam : all).slice(0, 4);

  return (
    <div className={`${archivo.variable} crit min-h-screen`}>
      <CareersHeader />
      <main>
        {accepting && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jobPostingJsonLd(opening, SITE_URL)) }} />}
        <RoleDetail opening={opening} accepting={accepting} others={others} />
      </main>
      <CareersFooter />
    </div>
  );
}
