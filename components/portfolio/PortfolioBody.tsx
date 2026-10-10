"use client";

import { useState } from "react";
import { Award, Download, ExternalLink, FileText, GitBranch, GraduationCap, Link2, Mail, MapPin, Phone, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ViewerSummary } from "@/lib/dashboard/viewer";
import { initialsOf } from "@/lib/dashboard/viewer";
import type { VaultItem } from "@/lib/vault/data";
import type { CapabilityGroup } from "@/lib/portfolio/view";
import { buildPortfolioSummary } from "@/lib/portfolio/summary";
import type { ArenaTask, GithubEvidence, InterviewSummary, PortfolioData } from "@/lib/portfolio/data";
import type { EducationEntry } from "@/lib/dashboard/education";
import { LiveStatus } from "@/components/portfolio/LiveStatus";
import type { PortfolioElo } from "@/lib/portfolio/elo";
import { EvidenceModal } from "@/components/portfolio/EvidenceModal";

const TYPE_ICON: Record<string, LucideIcon> = { certificate: Award, project: Sparkles, resume: FileText, link: Link2, other: FileText };
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
const MAX_SKILLS = 10;
const MAX_TASKS = 8;

/** Honest provenance on every claim: "Verified" only when a document backs it, otherwise "Self-reported". */
function TrustTag({ verified, verifiedLabel }: { verified: boolean; verifiedLabel: string }) {
  return verified ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--m-ground)] px-2.5 py-1 font-lp-body text-[12px] font-bold text-[var(--m-ink)]"><ShieldCheck size={13} aria-hidden className="text-[var(--m-accent-ink)]" />{verifiedLabel}</span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--m-rule)] px-2.5 py-1 font-lp-body text-[12px] text-[var(--m-muted)]">Self-reported</span>
  );
}

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
  profile: PortfolioData["profile"];
  education: EducationEntry[];
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
export function PortfolioBody({ viewer, profile, education, statedRole, groups, arenaTasks, github, items, elo, graph, mostRecent, isOwner, evidenceBaseUrl }: PortfolioBodyProps) {
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
  const empty = education.length === 0 && measured.length === 0 && arenaTasks.length === 0 && items.length === 0 && !github && groups.length === 0;

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
          <p className="mt-1 font-lp-body text-[15.5px] text-[var(--m-ink)]">{profile.headline ?? [viewer.branch, viewer.collegeName].filter(Boolean).join(", ")}</p>
          <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 font-lp-body text-[13.5px] text-[var(--m-muted)]">
            {profile.location && <li className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden />{profile.location}</li>}
            {profile.contact && <li><a href={`mailto:${profile.contact.email}`} className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)] hover:underline"><Mail size={14} aria-hidden />{profile.contact.email}</a></li>}
            {profile.contact?.phone && <li><a href={`tel:${profile.contact.phone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)] hover:underline"><Phone size={14} aria-hidden />{profile.contact.phone}</a></li>}
          </ul>
          {isOwner && <p className="mt-2 font-lp-body text-[12.5px] text-[var(--m-muted)] print:hidden">{profile.contactShared ? "Recruiters can see your email and mobile number." : "Your email and mobile number are hidden from recruiters."} <Link href="/profile" className="font-bold text-[var(--m-accent-ink)] hover:underline">Change in Profile</Link></p>}
          {githubVerified && <p className="mt-2 inline-flex items-center gap-1.5 font-lp-body text-[13px] font-bold text-[var(--m-ink)]"><ShieldCheck size={15} aria-hidden className="text-[var(--m-accent-ink)]" />GitHub ownership verified</p>}
        </div>
        <div className="flex flex-col items-end gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg border border-[var(--m-rule)] px-3.5 py-2 font-lp-body text-[13px] font-bold text-[var(--m-ink)] hover:bg-[var(--m-ground)]"><Download size={14} aria-hidden />Download PDF</button>
        <LiveStatus latestActivity={mostRecent} />
        </div>
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
            {profile.bio && <p className="mt-4 max-w-[68ch] whitespace-pre-line font-lp-body text-[14.5px] leading-[1.7] text-[var(--m-muted)]"><span className="font-bold text-[var(--m-ink)]">In their own words (self-written): </span>{profile.bio}</p>}
          </Section>

          {education.length > 0 && (
            <Section title="Education">
              <ul className="flex flex-col divide-y divide-[var(--m-rule)]">
                {education.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 py-3.5 first:pt-0">
                    <GraduationCap size={18} aria-hidden className="mt-0.5 shrink-0 text-[var(--m-muted)]" />
                    <div className="min-w-0 flex-1">
                      <p className="font-lp-body text-[15px] font-bold text-[var(--m-ink)]">{[e.degree, e.fieldOfStudy ?? e.branch].filter(Boolean).join(", ") || e.branch || "Education"}</p>
                      <p className="mt-0.5 font-lp-body text-[13.5px] text-[var(--m-ink)]">{[e.institutionName, [e.city, e.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>
                      <p className="mt-0.5 font-lp-body text-[13px] text-[var(--m-muted)]">{e.startYear ? `${e.startYear} – ${e.endYear ?? "Present"}` : e.endYear ? `Class of ${e.endYear}` : e.year ?? ""}</p>
                    </div>
                    <TrustTag verified={e.hasVerifiedCertificate} verifiedLabel="Verified by certificate" />
                  </li>
                ))}
              </ul>
            </Section>
          )}

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
                      <TrustTag verified={item.verified} verifiedLabel="Verified upload" />
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
