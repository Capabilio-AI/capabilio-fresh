"use client";

import { useState } from "react";
import { Award, Download, ExternalLink, FileText, GitBranch, Link2, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ViewerSummary } from "@/lib/dashboard/viewer";
import { initialsOf } from "@/lib/dashboard/viewer";
import type { VaultItem } from "@/lib/vault/data";
import type { CapabilityGroup } from "@/lib/portfolio/view";
import { buildPortfolioSummary } from "@/lib/portfolio/summary";
import type { ArenaTask, GithubEvidence, InterviewSummary, PortfolioData } from "@/lib/portfolio/data";
import type { PortfolioElo } from "@/lib/portfolio/elo";
import { EvidenceModal } from "@/components/portfolio/EvidenceModal";

const TYPE_ICON: Record<string, LucideIcon> = { certificate: Award, project: Sparkles, resume: FileText, link: Link2, other: FileText };
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
const MAX_SKILLS = 10;
const MAX_TASKS = 8;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="border-b border-[var(--m-rule)] pb-2 font-lp-display text-[18px] font-bold text-[var(--m-ink)]">{title}</h2>
      <div className="pt-4">{children}</div>
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
  graph: PortfolioData["graph"];
  isOwner: boolean;
  /** Base path for the evidence-popup fetch; attemptId is appended as the last segment. */
  evidenceBaseUrl: string;
}

/**
 * The portfolio a student hands a recruiter, laid out like a professional profile: who they are, a factual summary, the work they have
 * completed (each piece opens its full evidence), their measured skills, GitHub, and projects. Everything comes from verified records.
 */
export function PortfolioBody({ viewer, statedRole, groups, arenaTasks, github, items, elo, graph, isOwner, evidenceBaseUrl }: PortfolioBodyProps) {
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null);
  const githubVerified = github?.verified ?? false;
  const role = graph?.careerName ?? statedRole;

  const measured = (graph?.skills ?? []).filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, MAX_SKILLS);
  const scored = arenaTasks.filter((t) => t.score !== undefined);
  const averageScore = scored.length ? Math.round(scored.reduce((n, t) => n + (t.score ?? 0), 0) / scored.length) : null;
  const summary = buildPortfolioSummary({
    name: viewer.fullName, role, branch: viewer.branch, college: viewer.collegeName,
    readiness: graph?.readiness ?? null, skills: measured, verifiedChallenges: arenaTasks.length, averageScore,
    githubVerified, githubRepos: github?.repositoriesAnalyzed ?? null, projects: items.length,
  });
  const facts: [string, string][] = [
    ...(role ? [["Target role", role] as [string, string]] : []),
    ["ELO score", String(elo.rating)],
    ...(graph ? [["Role readiness", `${graph.readiness}%`] as [string, string]] : []),
    ["Verified tickets", String(arenaTasks.length)],
    ...(averageScore !== null ? [["Average score", `${averageScore}%`] as [string, string]] : []),
  ];
  const empty = measured.length === 0 && arenaTasks.length === 0 && items.length === 0 && !github && groups.length === 0;

  return (
    <article className="rounded-2xl border border-[var(--m-rule)] bg-white print:border-0">
      <header className="flex flex-wrap items-start gap-5 p-6 sm:p-8">
        <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--m-ink)] font-lp-display text-[24px] font-bold text-white">
          {viewer.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- storage-hosted user avatar, arbitrary origin
            <img src={viewer.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initialsOf(viewer.fullName, viewer.email)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-lp-display text-[30px] font-bold leading-tight text-[var(--m-ink)] sm:text-[34px]">{viewer.fullName ?? viewer.email}</h1>
          <p className="mt-1 font-lp-body text-[15px] text-[var(--m-muted)]">{[viewer.branch, viewer.collegeName].filter(Boolean).join(", ")}</p>
          {githubVerified && <p className="mt-2 inline-flex items-center gap-1.5 font-lp-body text-[13px] font-bold text-[var(--m-ink)]"><ShieldCheck size={15} aria-hidden className="text-[var(--m-accent-ink)]" />GitHub ownership verified</p>}
        </div>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-[var(--m-rule)] px-3.5 py-2 font-lp-body text-[13px] font-bold text-[var(--m-ink)] hover:bg-[var(--m-ground)] print:hidden"><Download size={14} aria-hidden />Download PDF</button>
      </header>

      <dl className="mx-6 flex flex-wrap gap-px overflow-hidden rounded-xl border border-[var(--m-rule)] bg-[var(--m-rule)] sm:mx-8">
        {facts.map(([k, v]) => (
          <div key={k} className="flex-1 basis-[140px] bg-white px-4 py-3">
            <dt className="font-lp-body text-[12px] text-[var(--m-muted)]">{k}</dt>
            <dd className="mt-0.5 font-lp-display text-[17px] font-bold tabular-nums text-[var(--m-ink)]">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-10 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-9">
          <Section title="Professional summary">
            <p className="max-w-[68ch] font-lp-body text-[15.5px] leading-[1.7] text-[var(--m-ink)]">{summary}</p>
          </Section>

          {arenaTasks.length > 0 && (
            <Section title="Verified work">
              <ul className="flex flex-col divide-y divide-[var(--m-rule)]">
                {arenaTasks.slice(0, MAX_TASKS).map((t) => (
                  <li key={t.attemptId} className="flex items-start justify-between gap-4 py-3.5 first:pt-0">
                    <div className="min-w-0">
                      <p className="font-lp-body text-[15px] font-bold text-[var(--m-ink)]">{t.title}</p>
                      <p className="mt-0.5 font-lp-body text-[13px] text-[var(--m-muted)]">{[t.company, t.score !== undefined ? `Score ${t.score}%` : null, fmtDate(t.completedAt)].filter(Boolean).join(" · ")}</p>
                    </div>
                    <button type="button" onClick={() => setOpenAttemptId(t.attemptId)} className="shrink-0 rounded-md px-2 py-1 font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:bg-[var(--m-ground)] print:hidden">View evidence</button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {items.length > 0 && (
            <Section title="Projects and certificates">
              <ul className="flex flex-col divide-y divide-[var(--m-rule)]">
                {items.map((item) => {
                  const Icon = TYPE_ICON[item.item_type] ?? FileText;
                  const href = item.fileUrl ?? item.url;
                  return (
                    <li key={item.id} className="flex items-start gap-3 py-3.5 first:pt-0">
                      <Icon size={17} aria-hidden className="mt-0.5 shrink-0 text-[var(--m-muted)]" />
                      <div className="min-w-0 flex-1">
                        <p className="font-lp-body text-[15px] font-bold text-[var(--m-ink)]">{item.title}</p>
                        {item.description && <p className="mt-0.5 line-clamp-2 font-lp-body text-[13px] text-[var(--m-muted)]">{item.description}</p>}
                      </div>
                      {href && <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline"><ExternalLink size={12} aria-hidden />View</a>}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {empty && (
            <p className="rounded-xl border border-dashed border-[var(--m-rule)] px-6 py-12 text-center font-lp-body text-[14px] text-[var(--m-muted)]">
              {isOwner ? "Nothing verified yet. Complete an Arena task or connect GitHub, and your portfolio builds itself from that evidence." : "Nothing verified yet."}
            </p>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-9">
          {measured.length > 0 && (
            <Section title="Measured skills">
              <ul className="flex flex-col gap-3.5">
                {measured.map((s) => (
                  <li key={s.name}>
                    <div className="flex items-baseline justify-between gap-3 font-lp-body text-[14px] text-[var(--m-ink)]"><span className="font-bold">{s.name}</span><span className="tabular-nums text-[var(--m-muted)]">{s.score}%</span></div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--m-ground)]"><div className="h-full rounded-full bg-[var(--m-accent)]" style={{ width: `${Math.min(100, s.score)}%` }} /></div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-lp-body text-[12.5px] leading-relaxed text-[var(--m-muted)]">Scores come from graded assessments and challenges on Capabilio, not self-reported.</p>
            </Section>
          )}

          {github && (
            <Section title="GitHub">
              <a href={github.profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-lp-body text-[15px] font-bold text-[var(--m-ink)] hover:underline"><GitBranch size={16} aria-hidden />{github.username}<ExternalLink size={12} className="text-[var(--m-muted)]" aria-hidden /></a>
              <p className="mt-1 font-lp-body text-[13px] text-[var(--m-muted)]">{[githubVerified ? "Ownership verified" : "Ownership not verified", github.repositoriesAnalyzed ? `${github.repositoriesAnalyzed} repositories analysed` : null].filter(Boolean).join(", ")}</p>
              {isOwner && <Link href="/dashboard/vault/code-dna" className="mt-2 inline-block font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline print:hidden">Open Code DNA</Link>}
            </Section>
          )}
        </aside>
      </div>

      {openAttemptId && <EvidenceModal fetchUrl={`${evidenceBaseUrl}/${openAttemptId}`} onClose={() => setOpenAttemptId(null)} />}
    </article>
  );
}
