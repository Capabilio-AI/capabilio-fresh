import type { Metadata } from "next";
import Link from "next/link";
import { Award, BadgeCheck, ExternalLink, FileText, GitBranch, Link2, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getVaultItems } from "@/lib/vault/data";
import { getViewerSummary, initialsOf } from "@/lib/dashboard/viewer";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { sourceLabel } from "@/lib/evidence/aggregate-capabilities";
import { buildCapabilityGroups, evidenceLine, type PortfolioEvidence } from "@/lib/portfolio/view";

export const metadata: Metadata = { title: "Portfolio — Capabilio AI" };

const TYPE_ICON: Record<string, LucideIcon> = { certificate: Award, project: Sparkles, resume: FileText, link: Link2, other: FileText };
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-lp-display text-[17px] font-semibold text-app-charcoal">{title}</h2>
      {sub && <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">{sub}</p>}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-3xl border border-[#E0E0E0] bg-white p-6 sm:p-7">{children}</section>;
}

/**
 * Evidence-first portfolio, following capabilio-web's order (hero → recruiter
 * snapshot → capabilities & evidence → Arena → GitHub → projects/certificates)
 * but showing only sections backed by real data. No bare ratings, levels or
 * scores — every capability line is a count of real evidence.
 */
export default async function PortfolioPage() {
  const { supabase, user } = await requireAuthedUser();

  const [viewer, statedRole, items, evidenceResult, { data: github }, { data: completions }, { data: assessed }] = await Promise.all([
    getViewerSummary(supabase, user.id),
    getStatedCareerInterest(supabase, user.id),
    getVaultItems(supabase, user.id),
    supabase.from("evidence").select("skill, source_type, evidence_type, source_url, observed_at, confidence, created_at, metadata").eq("user_id", user.id),
    supabase.from("github_connections").select("username, profile_url, verification_state, repositories_analyzed, last_scanned_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("arena_attempt_completions").select("attempt_id, skill_area_key, role_key, completed_at, challenge_id").eq("user_id", user.id).order("completed_at", { ascending: false }).limit(30),
    supabase.from("capabilities").select("skill").eq("user_id", user.id),
  ]);

  const evidence: PortfolioEvidence[] = (evidenceResult.data ?? []).map((r) => ({
    skill: r.skill,
    sourceType: r.source_type,
    evidenceType: r.evidence_type,
    sourceUrl: r.source_url,
    observedAt: r.observed_at,
    confidence: r.confidence,
    createdAt: r.created_at,
    metadata: r.metadata as PortfolioEvidence["metadata"],
  }));
  const groups = buildCapabilityGroups(evidence);
  const demonstrated = groups.flatMap((g) => g.capabilities);
  const demonstratedNames = new Set(demonstrated.map((c) => c.skill));

  const challengeIds = (completions ?? []).map((c) => c.challenge_id);
  const [{ data: challenges }, { data: areas }] = await Promise.all([
    challengeIds.length ? supabase.from("arena_challenges").select("id, title, content, requester").in("id", challengeIds) : Promise.resolve({ data: [] as { id: string; title: string; content: unknown; requester: string | null }[] }),
    supabase.from("arena_skill_areas").select("role_key, area_key, display_name"),
  ]);
  const arenaTasks = (completions ?? []).map((c) => {
    const ch = challenges?.find((x) => x.id === c.challenge_id);
    return {
      attemptId: c.attempt_id,
      title: ch?.title ?? "Arena task",
      company: (ch?.content as { company?: string } | null)?.company ?? null,
      area: areas?.find((a) => a.role_key === c.role_key && a.area_key === c.skill_area_key)?.display_name ?? c.skill_area_key,
      completedAt: c.completed_at,
    };
  });

  const githubVerified = github?.verification_state === "verified";
  const mostRecent = evidence.map((e) => e.observedAt ?? e.createdAt).sort().at(-1) ?? null;
  const assessedOnly = (assessed ?? []).filter((s) => !demonstratedNames.has(s.skill));
  const keyEvidence = [
    arenaTasks.length && `${arenaTasks.length} verified Arena task${arenaTasks.length === 1 ? "" : "s"}`,
    github?.repositories_analyzed && `${github.repositories_analyzed} GitHub repositories analysed`,
    items.length && `${items.length} Vault item${items.length === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Portfolio</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">What you&apos;ve demonstrated, not what you&apos;ve claimed. Built automatically from verified work.</p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>

      <div className="flex flex-col gap-5 pt-6">
        {/* Hero */}
        <Card>
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-app-orange-container font-lp-display text-[22px] font-bold text-app-orange">
              {viewer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- storage-hosted user avatar, arbitrary origin
                <img src={viewer.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initialsOf(viewer.fullName, viewer.email)
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-lp-display text-[24px] font-semibold leading-tight text-app-charcoal">{viewer.fullName ?? viewer.email}</p>
              <p className="mt-1 font-lp-body text-[13.5px] text-app-muted">{[statedRole && `Aspiring ${statedRole}`, viewer.branch, viewer.collegeName].filter(Boolean).join(" · ")}</p>
            </div>
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-lp-body text-[12.5px] font-semibold ${githubVerified ? "bg-app-success-container text-app-success" : "bg-app-attention-container text-app-attention"}`}>
              {githubVerified ? <ShieldCheck size={14} /> : null}
              {githubVerified ? "GitHub ownership verified" : "Identity self-reported"}
            </span>
          </div>
        </Card>

        {/* Recruiter snapshot */}
        <Card>
          <SectionTitle title="Recruiter snapshot" sub="At a glance — everything below links to the underlying evidence." />
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Direction", statedRole ?? "Not stated yet"],
              ["Strongest demonstrated", demonstrated.slice(0, 3).map((c) => c.skill).join(", ") || "Building up evidence"],
              ["Key evidence", keyEvidence.join(" · ") || "No evidence yet"],
              ["Most recent evidence", mostRecent ? fmtDate(mostRecent) : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-lp-mono text-[10.5px] text-app-muted">{k}</dt>
                <dd className="mt-1 font-lp-body text-[14px] font-semibold text-app-charcoal">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Demonstrated capabilities */}
        {groups.length > 0 && (
          <Card>
            <SectionTitle title="Demonstrated capabilities" sub="Each capability is backed by verified Arena work or observed GitHub activity — never self-reported." />
            <div className="flex flex-col gap-6">
              {groups.map((group) => (
                <div key={group.name}>
                  <h3 className="flex items-center gap-2 font-lp-body text-[14px] font-semibold text-app-charcoal">
                    <BadgeCheck size={16} className="text-app-success" />
                    {group.name}
                    <span className="font-normal text-app-muted">· {group.capabilities.length} demonstrated</span>
                  </h3>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {group.capabilities.map((cap) => (
                      <div key={cap.skill} className="rounded-2xl border border-app-border p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-lp-body text-[14.5px] font-semibold text-app-charcoal">{cap.skill}</p>
                          <span className="rounded-full bg-app-success-container px-2 py-0.5 font-lp-mono text-[10.5px] font-semibold text-app-success">Demonstrated</span>
                        </div>
                        <p className="mt-1 font-lp-body text-[12px] text-app-muted">Evidence: {evidenceLine(cap)}</p>
                        <ul className="mt-2.5 flex flex-col gap-1.5">
                          {cap.evidence.slice(0, 3).map((e, i) => (
                            <li key={i} className="flex items-center justify-between gap-3 font-lp-body text-[12px]">
                              <span className="min-w-0 truncate text-app-charcoal">
                                {e.sourceType === "arena_challenge" ? `${e.metadata?.company ? `${e.metadata.company} — ` : ""}${e.metadata?.title ?? "Arena task"}` : sourceLabel(e.sourceType)}
                                <span className="text-app-muted"> · {fmtDate(e.observedAt ?? e.createdAt)}</span>
                              </span>
                              {e.sourceUrl &&
                                (e.sourceUrl.startsWith("/") ? (
                                  <Link href={e.sourceUrl} className="shrink-0 font-lp-mono text-[11px] text-app-blue hover:underline">
                                    View evidence
                                  </Link>
                                ) : (
                                  <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 font-lp-mono text-[11px] text-app-blue hover:underline">
                                    <ExternalLink size={10} />
                                    View evidence
                                  </a>
                                ))}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Arena */}
        {arenaTasks.length > 0 && (
          <Card>
            <SectionTitle title="Arena — verified work" sub="Role tasks completed in Capabilio's workstations, graded automatically against a deterministic answer check." />
            <ul className="divide-y divide-app-border">
              {arenaTasks.map((t) => (
                <li key={t.attemptId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">{t.title}</p>
                    <p className="font-lp-mono text-[11px] text-app-muted">{[t.company, t.area, "Verified Arena submission", fmtDate(t.completedAt)].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Link href={`/arena/attempts/${t.attemptId}`} className="font-lp-mono text-[11.5px] text-app-blue hover:underline">
                    View evidence
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* GitHub */}
        {github && (
          <Card>
            <SectionTitle title="GitHub evidence" sub="From Code DNA in your Vault — observed repository activity, not claims." />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a href={github.profile_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-lp-body text-[14px] font-semibold text-app-charcoal hover:underline">
                <GitBranch size={16} />
                {github.username}
              </a>
              <span className="font-lp-mono text-[11.5px] text-app-muted">
                {[githubVerified ? "Ownership verified" : "Ownership not verified", github.repositories_analyzed ? `${github.repositories_analyzed} repositories analysed` : null, github.last_scanned_at ? `last scanned ${fmtDate(github.last_scanned_at)}` : null].filter(Boolean).join(" · ")}
              </span>
            </div>
            <Link href="/dashboard/vault/code-dna" className="mt-3 inline-block font-lp-mono text-[11.5px] text-app-blue hover:underline">
              Open Code DNA
            </Link>
          </Card>
        )}

        {/* Projects & certificates */}
        {items.length > 0 && (
          <Card>
            <SectionTitle title="Projects & certificates" sub="Added by you in the Vault." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const Icon = TYPE_ICON[item.item_type] ?? FileText;
                return (
                  <div key={item.id} className="rounded-2xl border border-app-border p-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-background text-app-muted">
                      <Icon size={15} />
                    </span>
                    <p className="mt-2.5 font-lp-body text-[13.5px] font-semibold text-app-charcoal">{item.title}</p>
                    <p className="font-lp-mono text-[10.5px] text-app-muted">{item.item_type}</p>
                    {item.description && <p className="mt-1.5 font-lp-body text-[12px] text-app-muted">{item.description}</p>}
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 font-lp-mono text-[11px] text-app-blue hover:underline">
                        <ExternalLink size={11} />
                        View
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Assessment-only skills */}
        {assessedOnly.length > 0 && (
          <Card>
            <SectionTitle title="From the onboarding assessment" sub="Measured in the initial assessment, not yet backed by project, Arena or GitHub evidence." />
            <div className="flex flex-wrap gap-1.5">
              {assessedOnly.map((s) => (
                <span key={s.skill} className="rounded-full bg-app-background px-2.5 py-1 font-lp-mono text-[11px] text-app-muted">
                  {s.skill}
                </span>
              ))}
            </div>
          </Card>
        )}

        {groups.length === 0 && arenaTasks.length === 0 && items.length === 0 && !github && (
          <div className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center font-lp-body text-[13.5px] text-app-muted">
            Nothing verified yet. Complete an Arena task or connect GitHub in your Vault — your portfolio builds itself from that evidence.
          </div>
        )}
      </div>
    </div>
  );
}
