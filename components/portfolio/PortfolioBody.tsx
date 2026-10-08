"use client";

import { useState } from "react";
import { Award, Download, ExternalLink, FileText, GitBranch, Link2, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ViewerSummary } from "@/lib/dashboard/viewer";
import { initialsOf } from "@/lib/dashboard/viewer";
import type { VaultItem } from "@/lib/vault/data";
import type { CapabilityGroup } from "@/lib/portfolio/view";
import { buildProfessionalSummary, evidenceLine, toRadarData } from "@/lib/portfolio/view";
import type { ArenaTask, GithubEvidence, InterviewSummary } from "@/lib/portfolio/data";
import type { PortfolioElo } from "@/lib/portfolio/elo";
import { EvidenceModal } from "@/components/portfolio/EvidenceModal";
import { RoundRadar } from "@/components/metro/RoundRadar";

const TYPE_ICON: Record<string, LucideIcon> = { certificate: Award, project: Sparkles, resume: FileText, link: Link2, other: FileText };
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--m-rule)] bg-white p-5 sm:p-6">
      <h2 className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">{title}</h2>
      {sub && <p className="mt-0.5 font-lp-body text-[13.5px] text-app-muted">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export interface PortfolioBodyProps {
  viewer: ViewerSummary;
  statedRole: string | null;
  groups: CapabilityGroup[];
  arenaTasks: ArenaTask[];
  /** Kept so the public share page and the dashboard pass the same data; interview sessions are practice and stay out of the recruiter view. */
  interviews?: InterviewSummary[];
  github: GithubEvidence | null;
  items: VaultItem[];
  keyEvidence: string[];
  mostRecent: string | null;
  elo: PortfolioElo;
  isOwner: boolean;
  /** Base path for the evidence-popup fetch; attemptId is appended as the last segment. */
  evidenceBaseUrl: string;
}

/**
 * The portfolio a student shows a recruiter: who they are, what they have demonstrated (radar plus the proof), verified Arena work,
 * GitHub, and their projects and certificates. Everything is built from verified evidence.
 */
export function PortfolioBody({ viewer, statedRole, groups, arenaTasks, github, items, keyEvidence, elo, isOwner, evidenceBaseUrl }: PortfolioBodyProps) {
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null);
  const demonstrated = groups.flatMap((g) => g.capabilities);
  const githubVerified = github?.verified ?? false;
  const radar = toRadarData(demonstrated, 8);
  const summary = buildProfessionalSummary({ statedRole, groups, elo, keyEvidence });
  const top = [...demonstrated].sort((a, b) => b.evidenceCount - a.evidenceCount).slice(0, 8);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl bg-[var(--m-ink)] p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white font-lp-display text-[22px] font-bold text-[var(--m-ink)]">
            {viewer.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- storage-hosted user avatar, arbitrary origin
              <img src={viewer.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initialsOf(viewer.fullName, viewer.email)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-lp-display text-[26px] font-bold leading-tight">{viewer.fullName ?? viewer.email}</p>
            <p className="mt-1 text-[14px] text-[var(--m-soft)]">{[statedRole && `Aspiring ${statedRole}`, viewer.branch, viewer.collegeName].filter(Boolean).join(", ")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {githubVerified && <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12.5px] font-bold"><ShieldCheck size={14} aria-hidden />GitHub verified</span>}
            <span className="rounded-full px-3 py-1.5 text-[12.5px] font-bold text-white" style={{ backgroundColor: elo.tier.color }}>{elo.tier.label} · ELO {elo.rating}</span>
            <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--m-ink)] transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"><Download size={13} aria-hidden />Download PDF</button>
          </div>
        </div>
        <p className="mt-5 max-w-[75ch] font-lp-body text-[14.5px] leading-relaxed text-white/90">{summary}</p>
      </section>

      {radar.length >= 3 && (
        <Section title="Demonstrated capabilities" sub="Every skill here is backed by verified Arena work or observed GitHub activity. The shape shows how much proof stands behind each skill.">
          <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_1fr]">
            <RoundRadar caption="Demonstrated capabilities" axes={radar.map((r) => ({ label: r.subject, value: r.value }))} />
            <ul className="flex flex-col gap-3">
              {top.map((cap) => {
                const first = cap.evidence[0];
                return (
                  <li key={cap.skill} className="rounded-xl border border-[var(--m-rule)] p-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-lp-body text-[14.5px] font-bold text-[var(--m-ink)]">{cap.skill}</p>
                      {first?.metadata?.attemptId ? (
                        <button type="button" onClick={() => setOpenAttemptId(first.metadata!.attemptId!)} className="shrink-0 text-[12.5px] font-bold text-[var(--m-accent-ink)] hover:underline">View evidence</button>
                      ) : first?.sourceUrl ? (
                        <a href={first.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-[var(--m-accent-ink)] hover:underline"><ExternalLink size={11} aria-hidden />View evidence</a>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-app-muted">{evidenceLine(cap)}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </Section>
      )}

      {arenaTasks.length > 0 && (
        <Section title="Verified Arena work" sub="Role tasks completed in Capabilio's workstations and graded automatically.">
          <ul className="grid gap-3 sm:grid-cols-2">
            {arenaTasks.slice(0, 6).map((t) => (
              <li key={t.attemptId} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--m-rule)] p-3.5">
                <div className="min-w-0">
                  <p className="font-lp-body text-[14px] font-bold text-[var(--m-ink)]">{t.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-app-muted">{[t.company, fmtDate(t.completedAt)].filter(Boolean).join(", ")}</p>
                </div>
                <button type="button" onClick={() => setOpenAttemptId(t.attemptId)} className="shrink-0 text-[12.5px] font-bold text-[var(--m-accent-ink)] hover:underline">View evidence</button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {github && (
        <Section title="GitHub" sub="Observed repository activity, open to review directly on GitHub.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a href={github.profileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-lp-body text-[15px] font-bold text-[var(--m-ink)] hover:underline"><GitBranch size={16} aria-hidden />{github.username}<ExternalLink size={13} className="text-app-muted" aria-hidden /></a>
            <span className="text-[12.5px] text-app-muted">{[githubVerified ? "Ownership verified" : "Ownership not verified", github.repositoriesAnalyzed ? `${github.repositoriesAnalyzed} repositories analysed` : null].filter(Boolean).join(", ")}</span>
          </div>
          {isOwner && <Link href="/dashboard/vault/code-dna" className="mt-3 inline-block text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline">Open Code DNA</Link>}
        </Section>
      )}

      {items.length > 0 && (
        <Section title="Projects and certificates">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const Icon = TYPE_ICON[item.item_type] ?? FileText;
              const href = item.fileUrl ?? item.url;
              return (
                <li key={item.id} className="rounded-xl border border-[var(--m-rule)] p-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--m-ground)] text-[var(--m-ink)]"><Icon size={16} aria-hidden /></span>
                  <p className="mt-2.5 font-lp-body text-[14px] font-bold text-[var(--m-ink)]">{item.title}</p>
                  {item.description && <p className="mt-1 line-clamp-2 text-[12.5px] text-app-muted">{item.description}</p>}
                  {href && <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-bold text-[var(--m-accent-ink)] hover:underline"><ExternalLink size={11} aria-hidden />View</a>}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {groups.length === 0 && arenaTasks.length === 0 && items.length === 0 && !github && (
        <div className="rounded-xl border border-dashed border-[var(--m-off)] bg-white px-6 py-14 text-center font-lp-body text-[14px] text-app-muted">
          {isOwner ? "Nothing verified yet. Complete an Arena task or connect GitHub, and your portfolio builds itself from that evidence." : "Nothing verified yet."}
        </div>
      )}

      {openAttemptId && <EvidenceModal fetchUrl={`${evidenceBaseUrl}/${openAttemptId}`} onClose={() => setOpenAttemptId(null)} />}
    </div>
  );
}
