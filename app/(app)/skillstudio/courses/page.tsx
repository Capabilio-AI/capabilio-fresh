import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Lock } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getStudentDirection } from "@/lib/career/direction";
import { tierRows, type TierNumber } from "@/lib/languages/tiers";
import { loadProvenTiers, PROOF_READY, type ProofArea } from "@/lib/languages/tier-proof";
import { AreaHero } from "@/components/metro/AreaHero";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Courses | SkillStudio | Capabilio AI" };

const AREAS: { area: ProofArea; title: string; blurb: string; href: string; cta: string }[] = [
  { area: "it", title: "IT courses", blurb: "The IT skills every student needs, whatever the branch.", href: "/skillstudio", cta: "Open role modules" },
  { area: "stream", title: "Stream courses", blurb: "Courses for your own branch.", href: "/skillstudio", cta: "Open role modules" },
  { area: "basic-programming", title: "Basic programming", blurb: "Python, Java, C, C++, SQL, HTML & CSS, JavaScript and C#, one module at a time.", href: "/skillstudio/courses/basic-programming", cta: "Choose a language" },
];

const STATUS_TEXT = { proven: "Proven", open: "Proof open", locked: "Locked until the tier before is proven" } as const;

/** Three course areas, each in four tiers. A tier is earned by passing its proof test, and the next tier's proof opens only after it. */
export default async function CoursesPage() {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const direction = await getStudentDirection(service, user.id);
  const year = direction?.academicYear?.year ?? null;
  const proven = new Map<ProofArea, TierNumber[]>();
  for (const a of AREAS) {
    // a proof table that cannot be read shows every tier as not yet proven rather than hiding the page
    proven.set(a.area, PROOF_READY.includes(a.area) ? await loadProvenTiers(service, user.id, a.area).catch(() => []) : []);
  }
  return (
    <div className="ss-studio">
      <AreaHero tone="tint" title="Courses" intro="Three areas, four tiers each. Read ahead any time; each tier's proof test opens once the tier before it is proven." nav={<SkillStudioSubNav />} />
      <ul className="grid gap-4 pt-6 lg:grid-cols-3">
        {AREAS.map((a) => {
          const ready = PROOF_READY.includes(a.area);
          return (
            <li key={a.area} className="flex flex-col gap-4 rounded-2xl border border-[var(--m-rule)] bg-white p-5">
              <div>
                <h2 className="font-lp-display text-[24px] font-bold leading-tight text-[var(--m-ink)]">{a.title}</h2>
                <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--m-muted)]">{a.blurb}</p>
              </div>
              <ol className="flex flex-col gap-2">
                {tierRows(proven.get(a.area) ?? [], year).map((t) => (
                  <li key={t.n} className="flex items-start gap-3 rounded-xl border border-[var(--m-rule)] px-3 py-2.5">
                    <span aria-hidden className="mt-0.5 text-[var(--m-accent-ink)]">{t.status === "proven" ? <Check size={16} /> : t.status === "locked" ? <Lock size={16} /> : <span className="ss-num text-[13px] font-bold">{t.n}</span>}</span>
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-bold text-[var(--m-ink)]">{t.label}{t.suggested && <span className="ml-2 rounded-full bg-[var(--m-accent-soft)] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--m-accent-ink)]">Your year</span>}</p>
                      <p className="text-[13px] text-[var(--m-muted)]">{ready ? STATUS_TEXT[t.status] : "Proof test comes with this area's content"}{ready && t.status === "open" && <>{" · "}<Link href={`/skillstudio/courses/proof?area=${a.area}&tier=${t.n}`} className="font-bold text-[var(--m-accent-ink)]">Take the proof</Link></>}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link href={a.href} className="group mt-auto inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--m-accent-ink)]">{a.cta}<ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
