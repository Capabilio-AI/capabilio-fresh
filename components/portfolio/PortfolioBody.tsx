"use client";

import type { SkillProficiency } from "@/lib/proficiency/by-skill";
import { EvidenceShareToggle } from "./EvidenceShareToggle";
import { useEffect, useRef, useState } from "react";
import { Award, ChevronRight, Download, ExternalLink, FileText, GraduationCap, Link2, Mail, MapPin, Phone, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ViewerSummary } from "@/lib/dashboard/viewer";
import { initialsOf } from "@/lib/dashboard/viewer";
import type { VaultItem } from "@/lib/vault/data";
import type { CapabilityGroup } from "@/lib/portfolio/view";
import { buildPortfolioSummary } from "@/lib/portfolio/summary";
import { GithubEvidenceCard } from "@/components/portfolio/GithubEvidenceCard";
import type { ArenaTask, GithubEvidence, InterviewSummary, PortfolioData } from "@/lib/portfolio/data";
import type { EducationEntry } from "@/lib/dashboard/education";
import { SkillSignal } from "@/components/portfolio/SkillSignal";
import { LiveNumber } from "@/components/portfolio/LiveNumber";
import { LiveStatus } from "@/components/portfolio/LiveStatus";
import type { PortfolioElo } from "@/lib/portfolio/elo";
import type { ArenaWorkRole } from "@/lib/portfolio/arena-work";
import type { ClassProject } from "@/lib/portfolio/class-projects";
import { EvidenceModal } from "@/components/portfolio/EvidenceModal";

const TYPE_ICON: Record<string, LucideIcon> = { certificate: Award, project: Sparkles, resume: FileText, link: Link2, other: FileText };
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
const MAX_SKILLS = 10;
const MAX_TASKS = 8;

/** Honest provenance on every claim: "Verified" only when a document backs it, otherwise "Self-reported". */
function TrustTag({ verified, verifiedLabel }: { verified: boolean; verifiedLabel: string }) {
  return verified ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--m-ground)] px-2.5 py-1 font-lp-body text-[12px] font-semibold text-[var(--m-ink)]"><ShieldCheck size={13} aria-hidden className="text-[var(--m-accent-ink)]" />{verifiedLabel}</span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--m-rule)]! px-2.5 py-1 font-lp-body text-[12px] text-[var(--m-muted)]">Self-reported</span>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-lp-display text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--m-muted)]">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
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
  classProjects: ClassProject[];
  arenaWork: ArenaWorkRole[];
  proficiency: SkillProficiency[];
  /** Kept so the public share page and the dashboard pass the same data; interview sessions are practice and stay out of the recruiter view. */
  interviews?: InterviewSummary[];
  github: GithubEvidence | null;
  items: VaultItem[];
  keyEvidence: string[];
  mostRecent: string | null;
  /** Endpoint the live status polls for a change fingerprint. */
  pulseUrl: string;
  elo: PortfolioElo;
  graph: PortfolioData["graph"];
  isOwner: boolean;
  /** Base path for the evidence-popup fetch; attemptId is appended as the last segment. */
  evidenceBaseUrl: string;
}

/**
 * The portfolio a person hands a recruiter: who they are, a factual summary, the work they have completed (each piece opens its full
 * evidence), their measured skills, GitHub and projects. Everything comes from verified records. It says nothing about a target role or
 * about learning: what a company needs is for the company to decide, from the evidence.
 */
export function PortfolioBody({ viewer, profile, education, arenaTasks, classProjects, arenaWork, proficiency, github, items, elo, graph, mostRecent, pulseUrl, isOwner, evidenceBaseUrl }: PortfolioBodyProps) {
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null);
  // Work that arrives while the page is open (live updates) is marked "New" for a few seconds so a watching recruiter sees what just landed.
  const seen = useRef(new Set(arenaTasks.map((t) => t.attemptId)));
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const added = arenaTasks.filter((t) => !seen.current.has(t.attemptId)).map((t) => t.attemptId);
    if (added.length === 0) return;
    added.forEach((id) => seen.current.add(id));
    setFresh(new Set(added));
    const t = setTimeout(() => setFresh(new Set()), 6000);
    return () => clearTimeout(t);
  }, [arenaTasks]);
  const githubVerified = github?.verified ?? false;

  const measured = (graph?.skills ?? []).filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, MAX_SKILLS);
  const scored = arenaTasks.filter((t) => t.score !== undefined);
  const averageScore = scored.length ? Math.round(scored.reduce((n, t) => n + (t.score ?? 0), 0) / scored.length) : null;
  const summary = buildPortfolioSummary({
    name: viewer.fullName, branch: viewer.branch, college: viewer.collegeName,
    skills: measured, verifiedChallenges: arenaTasks.length, averageScore,
    githubVerified, githubRepos: github?.repositoriesAnalyzed ?? null, projects: items.length,
  });
  const facts: [string, React.ReactNode][] = [
    ["ELO rating", <LiveNumber key="elo" value={elo.rating} />],
    ["Verified tickets", <LiveNumber key="tickets" value={arenaTasks.length} />],
    ...(averageScore !== null ? [["Average score", <LiveNumber key="avg" value={averageScore} suffix="%" />] as [string, React.ReactNode]] : []),
    ...(github?.repositoriesAnalyzed ? [["Repositories analysed", <LiveNumber key="repos" value={github.repositoriesAnalyzed} />] as [string, React.ReactNode]] : []),
  ];
  const empty = education.length === 0 && measured.length === 0 && arenaTasks.length === 0 && classProjects.length === 0 && items.length === 0 && !github;
  const headline = profile.headline ?? [viewer.branch, viewer.collegeName].filter(Boolean).join(", ");
  const email = profile.contact?.email;
  const phone = profile.contact?.phone;

  return (
    <article className="overflow-hidden rounded-3xl border border-[var(--m-rule)]! bg-white shadow-[0_1px_2px_rgba(12,16,32,0.04),0_12px_40px_-24px_rgba(12,16,32,0.25)] print:rounded-none print:border-0 print:shadow-none">
      <header className="border-b border-[var(--m-rule)]! bg-[var(--m-ground)] px-6 pb-7 pt-8 sm:px-10 sm:pt-10 print:bg-white">
        <div className="flex flex-wrap items-start gap-6">
          <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--m-ink)] font-lp-display text-[30px] font-bold text-white ring-4 ring-white">
            {viewer.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- storage-hosted user avatar, arbitrary origin
              <img src={viewer.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initialsOf(viewer.fullName, viewer.email)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-lp-display text-[32px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[40px]">{viewer.fullName ?? viewer.email}</h1>
            {headline && <p className="mt-1.5 font-lp-body text-[16px] text-[var(--m-ink)]/80">{headline}</p>}
            <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-lp-body text-[13.5px] text-[var(--m-muted)]">
              {profile.location && <li className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden />{profile.location}</li>}
              {githubVerified && <li className="inline-flex items-center gap-1.5 font-semibold text-[var(--m-ink)]"><ShieldCheck size={15} aria-hidden className="text-[var(--m-accent-ink)]" />GitHub ownership verified</li>}
              {phone && <li><a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-[var(--m-ink)] hover:underline"><Phone size={14} aria-hidden />{phone}</a></li>}
            </ul>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto sm:flex-col sm:items-end print:hidden">
            {email && <a href={`mailto:${email}`} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 font-lp-body text-[14px] font-semibold text-white transition-opacity hover:opacity-90"><Mail size={15} aria-hidden />Contact</a>}
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-[var(--m-rule)]! bg-white px-5 py-2.5 font-lp-body text-[14px] font-semibold text-[var(--m-ink)] hover:bg-[var(--m-ground)]"><Download size={15} aria-hidden />Download PDF</button>
            <LiveStatus pulseUrl={pulseUrl} initialLatest={mostRecent} />
          </div>
        </div>
        {isOwner && <p className="mt-5 font-lp-body text-[12.5px] text-[var(--m-muted)] print:hidden">{profile.contactShared ? "Recruiters can see your email and mobile number." : "Your email and mobile number are hidden from recruiters, so there is no Contact button."} <Link href="/profile" className="font-semibold text-[var(--m-accent-ink)] hover:underline">Change in Profile</Link></p>}
      </header>

      <dl className="flex flex-wrap divide-x divide-[var(--m-rule)]! border-b border-[var(--m-rule)]!">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-[50%] flex-1 border-t border-[var(--m-rule)]! px-6 py-5 first:border-t-0 sm:min-w-0 sm:border-t-0 sm:px-8 [&:nth-child(2)]:border-t-0">
            <dd className="font-lp-display text-[28px] font-bold tabular-nums leading-none text-[var(--m-ink)]">{v}</dd>
            <dt className="mt-2 font-lp-body text-[12.5px] text-[var(--m-muted)]">{k}</dt>
          </div>
        ))}
      </dl>

      <div className="grid gap-10 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
        <div className="flex min-w-0 flex-col gap-11">
          <Section title="Summary">
            <p className="max-w-[68ch] font-lp-body text-[16px] leading-[1.75] text-[var(--m-ink)]">{summary}</p>
            {profile.bio && <p className="mt-4 max-w-[68ch] whitespace-pre-line font-lp-body text-[15px] leading-[1.75] text-[var(--m-muted)]"><span className="font-semibold text-[var(--m-ink)]">In their own words: </span>{profile.bio}</p>}
          </Section>

          {measured.length > 0 && <SkillSignal skills={measured} />}

          {arenaTasks.length > 0 && (
            <Section title="Verified work" aside={<span className="font-lp-body text-[12.5px] text-[var(--m-muted)]">{arenaTasks.length} graded {arenaTasks.length === 1 ? "ticket" : "tickets"}</span>}>
              <ul className="grid gap-3">
                {arenaTasks.slice(0, MAX_TASKS).map((t) => (
                  <li key={t.attemptId} className={`rounded-2xl border border-[var(--m-rule)]! p-4 transition-colors duration-700 sm:p-5 ${fresh.has(t.attemptId) ? "bg-[var(--m-ground)]" : "bg-white"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-lp-body text-[15.5px] font-semibold text-[var(--m-ink)]">{t.title}{fresh.has(t.attemptId) && <span className="ml-2 rounded-full bg-[var(--m-accent)] px-2 py-0.5 align-middle font-lp-mono text-[11px] font-bold text-white">New</span>}</p>
                        <p className="mt-1 font-lp-body text-[13px] text-[var(--m-muted)]">{[t.company, t.area, fmtDate(t.completedAt)].filter(Boolean).join(" · ")}</p>
                      </div>
                      {t.score !== undefined && <span className="shrink-0 rounded-full bg-[var(--m-ground)] px-3 py-1 font-lp-display text-[15px] font-bold tabular-nums text-[var(--m-ink)] print:border print:border-[var(--m-rule)]!">{t.score}%</span>}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--m-rule)]! pt-3 print:hidden">
                      <button type="button" onClick={() => setOpenAttemptId(t.attemptId)} className="inline-flex items-center gap-1 font-lp-body text-[13px] font-semibold text-[var(--m-accent-ink)] hover:underline">View evidence<ChevronRight size={14} aria-hidden /></button>
                      {t.explanationScore !== undefined && <span className="font-lp-body text-[12.5px] text-[var(--m-muted)]">Explained {t.explanationScore}/100</span>}
                      {isOwner && t.sealed && <EvidenceShareToggle attemptId={t.attemptId} initialShared={t.sealed.shared} />}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {classProjects.length > 0 && (
            <Section title="Staff-graded projects" aside={<span className="font-lp-body text-[12.5px] text-[var(--m-muted)]">{classProjects.length} graded by college staff</span>}>
              <ul className="grid gap-3">
                {classProjects.map((p) => (
                  <li key={`${p.title}:${p.gradedAt}`} className="rounded-2xl border border-[var(--m-rule)]! bg-white p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-lp-body text-[15.5px] font-semibold text-[var(--m-ink)]">{p.title}</p>
                        <p className="mt-1 font-lp-body text-[13px] text-[var(--m-muted)]">{[p.subject, p.groupSize ? `Group of ${p.groupSize}` : null, `Graded by ${p.gradedBy}`, fmtDate(p.gradedAt)].filter(Boolean).join(" · ")}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--m-ground)] px-3 py-1 font-lp-display text-[15px] font-bold text-[var(--m-ink)] print:border print:border-[var(--m-rule)]">Grade {p.grade}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--m-rule)]! pt-3">
                      <TrustTag verified verifiedLabel="Verified by college staff" />
                      {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-lp-body text-[13px] font-semibold text-[var(--m-accent-ink)] hover:underline print:hidden"><ExternalLink size={12} aria-hidden />View project</a>}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {proficiency.length > 0 && (
            <Section title="Verified skill levels">
              <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {proficiency.map((s) => (
                  <li key={`${s.roleKey}:${s.skillId}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-lp-body text-[14.5px] font-semibold text-[var(--m-ink)]">{s.skillName}</p>
                      <p className="shrink-0 font-lp-body text-[12.5px] font-semibold text-[var(--m-accent-ink)]">{s.proficiency.name}</p>
                    </div>
                    <div className="mt-2 flex gap-1" role="img" aria-label={`Level ${s.proficiency.level} of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= s.proficiency.level ? "bg-[var(--m-accent)]" : "bg-[var(--m-rule)]"}`} />
                      ))}
                    </div>
                    <p className="mt-1.5 font-lp-body text-[12.5px] text-[var(--m-muted)]">Level {s.proficiency.level} of 5 · {s.proficiency.passes} graded task{s.proficiency.passes === 1 ? "" : "s"} passed</p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-lp-body text-[12.5px] text-[var(--m-muted)]">Levels come only from graded tasks, never from answers or self-ratings.</p>
            </Section>
          )}

          {arenaWork.length > 0 && (
            <Section title="Work by area">
              <ul className="grid gap-5">
                {arenaWork.map((r) => (
                  <li key={r.roleKey}>
                    <p className="font-lp-body text-[15px] font-semibold text-[var(--m-ink)]">{r.roleName}</p>
                    <p className="mt-0.5 font-lp-body text-[13px] text-[var(--m-muted)]">{[`${r.verifiedCount} graded task${r.verifiedCount === 1 ? "" : "s"} passed`, r.lastPassedAt ? `last passed ${fmtDate(r.lastPassedAt)}` : null].filter(Boolean).join(" · ")}</p>
                    <ul className="mt-2.5 flex flex-wrap gap-2">
                      {r.areas.map((a) => (
                        <li key={a.areaKey} className="rounded-full border border-[var(--m-rule)]! px-3 py-1 font-lp-body text-[12.5px] text-[var(--m-ink)]">
                          {a.areaName} · {a.verifiedCount}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {items.length > 0 && (
            <Section title="Projects and certificates">
              <ul className="grid gap-3">
                {items.map((item) => {
                  const Icon = TYPE_ICON[item.item_type] ?? FileText;
                  const href = item.fileUrl ?? item.url;
                  return (
                    <li key={item.id} className="flex items-start gap-3.5 rounded-2xl border border-[var(--m-rule)]! p-4">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--m-ground)] text-[var(--m-ink)]"><Icon size={17} aria-hidden /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-lp-body text-[15px] font-semibold text-[var(--m-ink)]">{item.title}</p>
                        {item.description && <p className="mt-0.5 line-clamp-2 font-lp-body text-[13px] text-[var(--m-muted)]">{item.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <TrustTag verified={item.verified} verifiedLabel="Verified upload" />
                          {href && <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-lp-body text-[13px] font-semibold text-[var(--m-accent-ink)] hover:underline print:hidden"><ExternalLink size={12} aria-hidden />View</a>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {empty && (
            <p className="rounded-2xl border border-dashed border-[var(--m-rule)]! px-6 py-12 text-center font-lp-body text-[14px] text-[var(--m-muted)]">
              {isOwner ? "Nothing verified yet. Complete an Arena task or connect GitHub, and your portfolio builds itself from that evidence." : "Nothing verified yet."}
            </p>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-10 lg:border-l lg:border-[var(--m-rule)]! lg:pl-10">
          {github && (
            <Section title="GitHub">
              <GithubEvidenceCard github={github} isOwner={isOwner} />
            </Section>
          )}

          {education.length > 0 && (
            <Section title="Education">
              <ul className="flex flex-col gap-5">
                {education.map((e) => (
                  <li key={e.id} className="flex items-start gap-3">
                    <GraduationCap size={18} aria-hidden className="mt-0.5 shrink-0 text-[var(--m-muted)]" />
                    <div className="min-w-0 flex-1">
                      <p className="font-lp-body text-[14.5px] font-semibold text-[var(--m-ink)]">{[e.degree, e.fieldOfStudy ?? e.branch].filter(Boolean).join(", ") || e.branch || "Education"}</p>
                      <p className="mt-0.5 font-lp-body text-[13px] text-[var(--m-ink)]">{[e.institutionName, [e.city, e.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>
                      <p className="mt-0.5 font-lp-body text-[12.5px] text-[var(--m-muted)]">{e.startYear ? `${e.startYear} – ${e.endYear ?? "Present"}` : e.endYear ? `Class of ${e.endYear}` : e.year ?? ""}</p>
                      <div className="mt-2"><TrustTag verified={e.hasVerifiedCertificate} verifiedLabel="Verified by certificate" /></div>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </aside>
      </div>

      {openAttemptId && <EvidenceModal fetchUrl={`${evidenceBaseUrl}/${openAttemptId}`} onClose={() => setOpenAttemptId(null)} />}
    </article>
  );
}
