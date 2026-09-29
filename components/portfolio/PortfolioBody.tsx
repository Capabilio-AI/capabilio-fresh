"use client";

import { useState } from "react";
import { Award, ChevronDown, Download, ExternalLink, FileText, GitBranch, Link2, ShieldCheck, Sparkles, BadgeCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ViewerSummary } from "@/lib/dashboard/viewer";
import { initialsOf } from "@/lib/dashboard/viewer";
import type { VaultItem } from "@/lib/vault/data";
import type { CapabilityGroup } from "@/lib/portfolio/view";
import { evidenceLine, toRadarData } from "@/lib/portfolio/view";
import { derivePersona } from "@/lib/portfolio/persona";
import { sourceLabel } from "@/lib/evidence/aggregate-capabilities";
import type { ArenaTask, GithubEvidence, InterviewSummary } from "@/lib/portfolio/data";
import { INTERVIEW_MODE_LABEL } from "@/lib/interview/session";
import type { PortfolioElo } from "@/lib/portfolio/elo";
import { EvidenceModal } from "@/components/portfolio/EvidenceModal";
import { SkillRadarChart } from "@/components/dashboard/SkillRadarChart";

const TYPE_ICON: Record<string, LucideIcon> = { certificate: Award, project: Sparkles, resume: FileText, link: Link2, other: FileText };
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
const fmtDuration = (seconds: number) => (seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)} min`);

function InterviewCard({ interview }: { interview: InterviewSummary }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-2xl border border-app-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">{INTERVIEW_MODE_LABEL[interview.mode] ?? interview.mode} round</p>
          <p className="font-lp-mono text-[11px] text-app-muted">
            {[interview.roleTarget, interview.domain, `${interview.questionCount} questions`, fmtDuration(interview.durationSeconds), fmtDate(interview.completedAt)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-app-success-container px-2.5 py-1 font-lp-mono text-[11.5px] font-semibold text-app-success">{interview.overallScore}/100</span>
          <button type="button" onClick={() => setExpanded((e) => !e)} aria-label="Toggle detail" className="rounded-full p-1 text-app-muted hover:bg-app-background">
            <ChevronDown size={16} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-app-border pt-3">
          {Object.keys(interview.skillScores).length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(interview.skillScores).map(([skill, score]) => (
                <div key={skill} className="rounded-lg bg-app-background px-3 py-2">
                  <p className="font-lp-mono text-[10.5px] text-app-muted">{skill}</p>
                  <p className="font-lp-body text-[13px] font-semibold text-app-charcoal">{score}/100</p>
                </div>
              ))}
            </div>
          )}
          {interview.strengths.length > 0 && (
            <div>
              <p className="font-lp-body text-[12px] font-semibold text-app-charcoal">Strengths</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {interview.strengths.map((s, i) => (
                  <li key={i} className="font-lp-body text-[12.5px] text-app-charcoal">
                    · {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {interview.improvements.length > 0 && (
            <div>
              <p className="font-lp-body text-[12px] font-semibold text-app-charcoal">To improve</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {interview.improvements.map((s, i) => (
                  <li key={i} className="font-lp-body text-[12.5px] text-app-charcoal">
                    · {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

export interface PortfolioBodyProps {
  viewer: ViewerSummary;
  statedRole: string | null;
  groups: CapabilityGroup[];
  arenaTasks: ArenaTask[];
  interviews: InterviewSummary[];
  github: GithubEvidence | null;
  items: VaultItem[];
  keyEvidence: string[];
  mostRecent: string | null;
  elo: PortfolioElo;
  isOwner: boolean;
  /** Base path for the evidence-popup fetch — attemptId is appended as the last segment. */
  evidenceBaseUrl: string;
}

/**
 * Evidence-first portfolio body, shared by the owner's dashboard page and the
 * public share page. "View evidence" opens a popup instead of navigating away
 * so a recruiter can review proof without losing their place.
 */
export function PortfolioBody({ viewer, statedRole, groups, arenaTasks, interviews, github, items, keyEvidence, mostRecent, elo, isOwner, evidenceBaseUrl }: PortfolioBodyProps) {
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null);
  const demonstrated = groups.flatMap((g) => g.capabilities);
  const githubVerified = github?.verified ?? false;
  const persona = derivePersona(groups);
  const radarData = toRadarData(demonstrated);

  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <Card>
        <div className="mb-4 flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-full border border-app-border px-3 py-1.5 font-lp-mono text-[11.5px] font-semibold text-app-charcoal hover:bg-app-background"
          >
            <Download size={13} />
            Download PDF
          </button>
        </div>
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
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-lp-mono text-[12.5px] font-bold text-white" style={{ backgroundColor: elo.tier.color }}>
              {elo.tier.label} · ELO {elo.rating}
            </span>
            <div className="h-1 w-28 overflow-hidden rounded-full bg-app-background">
              <div className="h-full rounded-full" style={{ width: `${elo.progressToNextTier}%`, backgroundColor: elo.tier.color }} />
            </div>
          </div>
        </div>
      </Card>

      {/* Recruiter snapshot */}
      <Card>
        <SectionTitle title="Recruiter snapshot" sub="At a glance — everything below links to the underlying evidence." />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Direction", statedRole ?? "Not stated yet"],
            ["Arena Rating", `${elo.rating} · ${elo.tier.label}`],
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

      {/* AI-assigned identity — derived from verified evidence only */}
      {persona && (
        <Card>
          <SectionTitle title={persona.title} sub={persona.description} />
          <p className="font-lp-body text-[12.5px] text-app-muted">Assigned from this candidate&apos;s strongest verified capability group — not a self-assessment.</p>
        </Card>
      )}

      {/* Demonstrated capabilities */}
      {groups.length > 0 && (
        <Card>
          <SectionTitle title="Demonstrated capabilities" sub="Each capability is backed by verified Arena work or observed GitHub activity — never self-reported." />
          {radarData.length > 0 && (
            <div className="mb-6 rounded-2xl border border-app-border p-4">
              <p className="mb-1 font-lp-mono text-[10.5px] text-app-muted">EVIDENCE DENSITY — not a skill level, a count of verified proof per skill</p>
              <SkillRadarChart data={radarData} series={[{ key: "value", label: "Evidence density", color: "#ff5701" }]} height={260} />
            </div>
          )}
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
                            {e.metadata?.attemptId ? (
                              <button type="button" onClick={() => setOpenAttemptId(e.metadata!.attemptId!)} className="shrink-0 font-lp-mono text-[11px] text-app-blue hover:underline">
                                View evidence
                              </button>
                            ) : (
                              e.sourceUrl && (
                                <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 font-lp-mono text-[11px] text-app-blue hover:underline">
                                  <ExternalLink size={10} />
                                  View evidence
                                </a>
                              )
                            )}
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
                <button type="button" onClick={() => setOpenAttemptId(t.attemptId)} className="font-lp-mono text-[11.5px] text-app-blue hover:underline">
                  View evidence
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* AI Interviews */}
      {interviews.length > 0 && (
        <Card>
          <SectionTitle title="AI interview sessions" sub="Completed interview rounds, scored automatically from the transcript." />
          <div className="flex flex-col gap-3">
            {interviews.map((interview) => (
              <InterviewCard key={interview.id} interview={interview} />
            ))}
          </div>
        </Card>
      )}

      {/* GitHub */}
      {github && (
        <Card>
          <SectionTitle title="GitHub evidence" sub="Observed repository activity, not claims — open to review directly on GitHub." />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a href={github.profileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-lp-body text-[14px] font-semibold text-app-charcoal hover:underline">
              <GitBranch size={16} />
              {github.username}
              <ExternalLink size={13} className="text-app-muted" />
            </a>
            <span className="font-lp-mono text-[11.5px] text-app-muted">
              {[githubVerified ? "Ownership verified" : "Ownership not verified", github.repositoriesAnalyzed ? `${github.repositoriesAnalyzed} repositories analysed` : null, github.lastScannedAt ? `last scanned ${fmtDate(github.lastScannedAt)}` : null].filter(Boolean).join(" · ")}
            </span>
          </div>
          {isOwner && (
            <Link href="/dashboard/vault/code-dna" className="mt-3 inline-block font-lp-mono text-[11.5px] text-app-blue hover:underline">
              Open Code DNA
            </Link>
          )}
        </Card>
      )}

      {/* Projects & certificates */}
      {items.length > 0 && (
        <Card>
          <SectionTitle title="Projects & certificates" sub={isOwner ? "Added by you in the Vault." : "Added by the candidate in their Vault."} />
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
                  {(item.fileUrl ?? item.url) && (
                    <a href={item.fileUrl ?? item.url ?? undefined} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 font-lp-mono text-[11px] text-app-blue hover:underline">
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

      {groups.length === 0 && arenaTasks.length === 0 && interviews.length === 0 && items.length === 0 && !github && (
        <div className="rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center font-lp-body text-[13.5px] text-app-muted">
          {isOwner ? "Nothing verified yet. Complete an Arena task or connect GitHub in your Vault — your portfolio builds itself from that evidence." : "Nothing verified yet."}
        </div>
      )}

      {openAttemptId && <EvidenceModal fetchUrl={`${evidenceBaseUrl}/${openAttemptId}`} onClose={() => setOpenAttemptId(null)} />}
    </div>
  );
}
