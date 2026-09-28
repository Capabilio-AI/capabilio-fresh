import type { Metadata } from "next";
import { Award, ExternalLink, FileText, Link2, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getVaultItems } from "@/lib/vault/data";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { aggregateDemonstratedCapabilities, LOW_STRENGTH_THRESHOLD, sourceLabel, type EvidenceRecord } from "@/lib/evidence/aggregate-capabilities";

export const metadata: Metadata = { title: "Portfolio — Capabilio AI" };

const TYPE_ICON: Record<string, LucideIcon> = {
  certificate: Award,
  project: Sparkles,
  resume: FileText,
  link: Link2,
  other: FileText,
};

export default async function PortfolioPage() {
  const { supabase, user } = await requireAuthedUser();

  const [items, { data: rating }, evidenceResult, { data: statedSkills }] = await Promise.all([
    getVaultItems(supabase, user.id),
    supabase.from("arena_ratings").select("rating").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("evidence")
      .select("skill, source_type, evidence_type, source_url, observed_at, confidence, created_at")
      .eq("user_id", user.id),
    supabase.from("capabilities").select("skill, domain").eq("user_id", user.id),
  ]);

  const evidenceRows: EvidenceRecord[] = (evidenceResult.data ?? []).map((r) => ({
    skill: r.skill,
    sourceType: r.source_type,
    evidenceType: r.evidence_type,
    sourceUrl: r.source_url,
    observedAt: r.observed_at,
    confidence: r.confidence,
    createdAt: r.created_at,
  }));
  const demonstratedCapabilities = aggregateDemonstratedCapabilities(evidenceRows);
  const demonstratedSkillNames = new Set(demonstratedCapabilities.map((c) => c.skill));
  // "Candidate stated" is shown only for skills without evidence backing it
  // -- once evidence exists, the Demonstrated Capabilities section is the
  // honest place to show that skill, not a duplicate unverified claim.
  const statedOnly = (statedSkills ?? []).filter((s) => !demonstratedSkillNames.has(s.skill));

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Portfolio</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        What you&apos;ve demonstrated, not what you&apos;ve claimed. Vault is where you add
        evidence; Portfolio is how it&apos;s shown.
      </p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>

      <div className="pt-6">
        {demonstratedCapabilities.length > 0 && (
          <div className="mb-6">
            <h2 className="font-lp-display text-[16px] font-semibold text-app-charcoal">Demonstrated Capabilities</h2>
            <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">
              Built from real, source-linked evidence — not self-reported skills.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {demonstratedCapabilities.map((cap) => (
                <div key={cap.skill} className="rounded-xl border border-app-border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-lp-body text-[14px] font-semibold text-app-charcoal">{cap.skill}</p>
                    {cap.strength >= LOW_STRENGTH_THRESHOLD ? (
                      <span className="font-lp-mono text-[13px] font-semibold text-app-charcoal">{cap.strength}</span>
                    ) : (
                      <span className="font-lp-mono text-[10.5px] text-app-muted">Limited evidence</span>
                    )}
                  </div>
                  <p className="mt-0.5 font-lp-mono text-[10.5px] text-app-muted">
                    {cap.evidenceCount} evidence item{cap.evidenceCount === 1 ? "" : "s"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cap.sourceMix.map((s) => (
                      <span key={s} className="rounded-full border border-app-border px-2 py-0.5 font-lp-mono text-[10px] text-app-charcoal">
                        {sourceLabel(s)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-col gap-1">
                    {cap.items.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex items-center justify-between font-lp-mono text-[10.5px] text-app-muted">
                        <span>{sourceLabel(item.sourceType)}</span>
                        {item.sourceUrl && (
                          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-app-blue hover:underline">
                            <ExternalLink size={10} />
                            View evidence
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {statedOnly.length > 0 && (
          <div className="mb-6">
            <h2 className="font-lp-display text-[16px] font-semibold text-app-charcoal">Candidate Stated</h2>
            <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">
              Self-reported, not yet backed by evidence.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {statedOnly.map((s) => (
                <span key={s.skill} className="rounded-full bg-app-background px-2.5 py-1 font-lp-mono text-[11px] text-app-muted">
                  {s.skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {rating && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-app-border bg-white p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-orange-container text-app-orange">
              <Trophy size={18} />
            </span>
            <div>
              <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">Arena rating: {rating.rating}</p>
              <p className="font-lp-mono text-[11px] text-app-muted">Earned from timed challenge performance</p>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
            <p className="font-lp-body text-[13.5px] text-app-muted">
              Nothing to show yet. Add certificates, projects, or links to your Vault — they&apos;ll appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const Icon = TYPE_ICON[item.item_type] ?? FileText;
              return (
                <div key={item.id} className="rounded-xl border border-app-border bg-white p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-app-background text-app-muted">
                    <Icon size={16} />
                  </span>
                  <p className="mt-3 font-lp-body text-[14px] font-semibold text-app-charcoal">{item.title}</p>
                  <p className="mt-0.5 font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">
                    {item.item_type}
                  </p>
                  {item.description && (
                    <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">{item.description}</p>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1 font-lp-mono text-[11px] text-app-blue hover:underline"
                    >
                      <ExternalLink size={12} />
                      View
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
