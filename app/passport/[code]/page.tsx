import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MetroScope } from "@/components/metro/MetroScope";
import { SkillBadgeGrid } from "@/components/profile/PassportSection";
import { EvidenceSection } from "@/components/passport/EvidenceSection";
import { ReelPlayer } from "@/components/passport/reel/ReelPlayer";
import { createServiceClient } from "@/lib/supabase/service";
import { loadReel } from "@/lib/passport/reel-data";

// A passport is private data the student chose to share: never index it, and look it up only while their switch is on.
export const metadata: Metadata = { title: "Skill passport — Capabilio AI", robots: { index: false, follow: false } };

export default async function PublicPassportPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const service = createServiceClient();
  const { data: owner } = await service.from("profiles").select("id, passport_public").eq("passport_code", code).maybeSingle();
  if (!owner?.passport_public) notFound();

  const { input, passport, evidence } = await loadReel(service, owner.id);
  const earned = passport.skills.filter((s) => s.badge).length;
  const h = input.holder;

  return (
    <MetroScope>
      <div className="min-h-screen bg-[var(--m-ink)] px-4 py-8 text-white sm:px-8 sm:py-12">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
          <div className="mx-auto w-full max-w-[380px] lg:sticky lg:top-8">
            <p className="mb-3 flex items-center gap-2 font-lp-body text-[12px] font-bold uppercase tracking-wider text-white/60">
              <svg width="36" height="12" viewBox="0 0 44 14" aria-hidden><path d="M3 7h38" stroke="var(--m-accent)" strokeWidth="4" strokeLinecap="round" /><circle cx="3" cy="7" r="3" fill="var(--m-ink)" stroke="#fff" strokeWidth="2.5" /><circle cx="22" cy="7" r="3" fill="var(--m-ink)" stroke="#fff" strokeWidth="2.5" /><circle cx="41" cy="7" r="3" fill="var(--m-ink)" stroke="#fff" strokeWidth="2.5" /></svg>
              Verified skill passport
            </p>
            <ReelPlayer input={input} />
          </div>

          <div className="flex flex-col gap-5 text-[var(--m-ink)]">
            <section aria-labelledby="holder" className="rounded-2xl bg-white p-5 sm:p-6">
              <h1 id="holder" className="break-words font-lp-display text-[28px] font-bold leading-tight sm:text-[34px]">{h.name}</h1>
              <p className="mt-1 font-lp-body text-[14.5px] text-[var(--m-muted)]">{[h.college, h.branch, h.classOf ? `Class of ${h.classOf}` : null].filter(Boolean).join(" · ")}</p>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <div><dt className="font-lp-body text-[11.5px] font-bold uppercase tracking-wider text-[var(--m-muted)]">Passport no.</dt><dd className="mt-0.5 font-lp-display text-[18px] font-bold tabular-nums">{h.passportNo}</dd></div>
                <div><dt className="font-lp-body text-[11.5px] font-bold uppercase tracking-wider text-[var(--m-muted)]">Badges earned</dt><dd className="mt-0.5 font-lp-display text-[18px] font-bold tabular-nums">{earned}</dd></div>
                {h.aspiringFor && <div><dt className="font-lp-body text-[11.5px] font-bold uppercase tracking-wider text-[var(--m-muted)]">Aspiring for</dt><dd className="mt-0.5 font-lp-display text-[18px] font-bold">{h.aspiringFor}</dd></div>}
              </dl>
            </section>

            <section aria-labelledby="badges" className="rounded-2xl bg-white p-5 sm:p-6">
              <h2 id="badges" className="font-lp-display text-[20px] font-bold">Skill badges</h2>
              <p className="mt-1 mb-4 font-lp-body text-[13.5px] text-[var(--m-muted)]">Earned from measured assessments and challenges on Capabilio, not self-reported.</p>
              {passport.unlocked ? <SkillBadgeGrid skills={passport.skills} /> : <p className="font-lp-body text-[14px] text-[var(--m-muted)]">This student hasn&apos;t earned any badges yet.</p>}
            </section>

            <EvidenceSection evidence={evidence} />

            <section aria-labelledby="verify" className="rounded-2xl bg-white p-5 sm:p-6">
              <h2 id="verify" className="font-lp-display text-[20px] font-bold">How to verify this</h2>
              <p className="mt-1 font-lp-body text-[13.5px] leading-relaxed text-[var(--m-muted)]">This page is drawn live from Capabilio&apos;s record, so it can&apos;t be edited or screenshot-faked. The fingerprint below changes the moment any evidence changes: scan again later and compare.</p>
              <p className="mt-3 break-all font-mono text-[16px] font-semibold tracking-wide text-[var(--m-accent-ink)]">{input.fingerprint}</p>
              {input.measuredAt && <p className="mt-1 font-lp-body text-[12.5px] text-[var(--m-muted)]">Last measured {input.measuredAt.slice(0, 10)}</p>}
            </section>
            <p className="font-lp-body text-[12.5px] text-white/60">Shared by the holder, who can turn this page off at any time.</p>
          </div>
        </div>
      </div>
    </MetroScope>
  );
}
