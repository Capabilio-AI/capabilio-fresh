import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { requireStage } from "@/lib/stage/guard";
import { loadProfessional } from "@/lib/professional/data";
import { fmtExperience } from "@/lib/professional/experience";
import { LEVEL_LABEL, groupSkills, type ProSkill } from "@/lib/professional/skills";
import { listSkills } from "@/lib/professional/workspace-server";
import { Badges } from "@/components/professional/home/Badges";
import { PrintButton } from "@/components/professional/home/PrintButton";
import { ProTabs } from "@/components/professional/home/ProTabs";
import { ProAvatar } from "@/components/professional/pulse/ProAvatar";

export const metadata: Metadata = { title: "Portfolio — Capabilio AI" };

const LEVEL_BARS: Record<ProSkill["level"], number> = { learning: 1, working: 2, expert: 3 };
const href = (u: string) => (/^https?:\/\//.test(u) ? u : `https://${u}`);

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28 border-t border-[var(--m-ink)] pt-5 print:break-inside-avoid">
      <h2 id={`${id}-h`} className="font-lp-display text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--m-ink)]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** A professional's portfolio, set out like a personal site and a CV in one: a masthead, the numbers that matter, then each part of the record. */
export default async function ProfessionalPortfolio() {
  await requireStage(["professional"]);
  const { user } = await requireAuthedUser();
  const d = await loadProfessional(user.id);
  // The skill list is optional here: if it cannot load, the portfolio still shows everything else.
  const skills = await listSkills(user.id).then((r) => r.skills, () => [] as ProSkill[]);
  const groups = groupSkills(skills);
  const headline = d.headline ?? ([d.jobTitle, d.employer].filter(Boolean).join(" at ") || null);
  const name = d.name ?? "Your portfolio";
  const facts: [string, string][] = [
    [d.experienceMonths > 0 ? fmtExperience(d.experienceMonths).replace(" years", " yrs").replace(" year", " yr").replace(" months", " mo").replace(" month", " mo") : "n/a", "experience"],
    [String(d.work.length), d.work.length === 1 ? "role" : "roles"],
    [String(skills.length), skills.length === 1 ? "skill" : "skills"],
    [String(d.certifications.length + d.awards.length), "certifications and awards"],
  ];
  const sections = [
    (d.about || d.location) && ["about", "About"],
    d.work.length > 0 && ["experience", "Experience"],
    groups.length > 0 && ["skills", "Skills"],
    d.projects.length > 0 && ["projects", "Projects"],
    d.certifications.length > 0 && ["certifications", "Certifications"],
    d.awards.length > 0 && ["awards", "Awards and badges"],
    d.education.length > 0 && ["education", "Education"],
  ].filter(Boolean) as [string, string][];
  const empty = sections.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="print:hidden"><ProTabs /></div>
      <article className="overflow-hidden rounded-[2rem] border border-[var(--m-rule)] bg-white print:rounded-none print:border-0">
        <header>
          <div className="relative h-44 overflow-hidden bg-[var(--m-ink)] sm:h-60 print:h-24">
            {/* eslint-disable-next-line @next/next/no-img-element -- storage-hosted cover, arbitrary origin */}
            {d.coverUrl && <img src={d.coverUrl} alt="" className="absolute inset-0 size-full object-cover opacity-80" />}
            {!d.coverUrl && <><span aria-hidden className="absolute -right-24 -top-24 h-[22rem] w-[22rem] rounded-full border-[36px] border-white/[0.07]" /><span aria-hidden className="absolute -right-2 -top-2 h-[12rem] w-[12rem] rounded-full border-[22px] border-[var(--m-accent)]/40" /></>}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          </div>
          <div className="px-6 pb-8 sm:px-12">
            <div className="-mt-16 flex flex-wrap items-end justify-between gap-4 sm:-mt-20">
              <span className="block overflow-hidden rounded-full border-[5px] border-white bg-white shadow-sm"><ProAvatar name={name} url={d.avatarUrl} size={128} /></span>
              <PrintButton />
            </div>
            <h1 className="mt-5 font-lp-display text-[40px] font-bold leading-[1.02] tracking-tight text-[var(--m-ink)] sm:text-[58px]">{name}</h1>
            {headline && <p className="mt-2 max-w-[60ch] text-[18px] leading-snug text-[var(--m-ink)] sm:text-[21px]">{headline}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-[var(--m-muted)]">
              {d.location && <span>{d.location}</span>}
              {d.links.map((l) => <a key={l.id} href={href(l.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-[var(--m-ink)] underline decoration-[var(--m-accent)] decoration-2 underline-offset-4 hover:text-[var(--m-accent-ink)]">{l.label}<ExternalLink size={12} aria-hidden /></a>)}
            </div>
            <div className="mt-4"><Badges epfoVerified={d.epfoVerified} mentorApproved={d.mentorApproved} /></div>
          </div>
          <dl className="grid grid-cols-2 border-y border-[var(--m-rule)] sm:grid-cols-4">
            {facts.map(([v, l], i) => <div key={l} className={`px-6 py-5 sm:px-8 ${i > 0 ? "sm:border-l sm:border-[var(--m-rule)]" : ""} ${i === 2 ? "border-t border-[var(--m-rule)] sm:border-t-0" : ""} ${i === 3 ? "border-l border-t border-[var(--m-rule)] sm:border-t-0" : ""}`}><dd className="font-lp-display text-[28px] font-bold leading-none tabular-nums text-[var(--m-ink)] sm:text-[34px]">{v}</dd><dt className="mt-1.5 text-[12.5px] text-[var(--m-muted)]">{l}</dt></div>)}
          </dl>
        </header>

        {empty ? (
          <div className="px-6 py-14 text-center sm:px-12"><p className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Your portfolio builds itself</p><p className="mx-auto mt-2 max-w-[48ch] text-[14.5px] text-[var(--m-muted)]">Upload your resume on the Overview page, or fill in your Profile and Skill graph, and it appears here.</p></div>
        ) : (
          <div className="grid gap-10 px-6 py-10 sm:px-12 md:grid-cols-[170px_minmax(0,1fr)] print:block">
            <nav aria-label="Sections" className="hidden self-start md:sticky md:top-28 md:block print:hidden">
              <ul className="space-y-2.5 text-[14px]">{sections.map(([id, label]) => <li key={id}><a href={`#${id}`} className="font-bold text-[var(--m-muted)] hover:text-[var(--m-ink)]">{label}</a></li>)}</ul>
            </nav>
            <div className="flex min-w-0 flex-col gap-12">
              {(d.about || d.location) && <Section id="about" title="About">{d.about ? <p className="max-w-[62ch] text-[17px] leading-[1.7] text-[var(--m-ink)]">{d.about}</p> : <p className="text-[15px] text-[var(--m-muted)]">{d.location}</p>}</Section>}

              {d.work.length > 0 && (
                <Section id="experience" title="Experience">
                  <ol className="flex flex-col gap-8">
                    {d.work.map((w) => (
                      <li key={w.id} className="grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-8 print:break-inside-avoid">
                        <div className="text-[13.5px] tabular-nums text-[var(--m-muted)]"><p className="font-bold text-[var(--m-ink)]">{w.period.replace(" to ", " – ")}</p>{w.months > 0 && <p>{fmtExperience(w.months)}</p>}</div>
                        <div className="min-w-0">
                          <h3 className="font-lp-display text-[19px] font-bold leading-snug text-[var(--m-ink)]">{w.title}</h3>
                          <p className="text-[15px] text-[var(--m-ink)]">{w.organisation}{w.current && <span className="ml-2 rounded-full bg-[var(--m-accent-soft)] px-2 py-0.5 align-middle text-[11.5px] font-bold text-[var(--m-accent-ink)]">Current</span>}</p>
                          {w.description && <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-[var(--m-muted)]">{w.description}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                  {!d.epfoVerified && <p className="mt-6 text-[12.5px] text-[var(--m-muted)]">Self-reported. This becomes verified once EPFO confirms the employment.</p>}
                </Section>
              )}

              {groups.length > 0 && (
                <Section id="skills" title="Skills">
                  <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
                    {groups.map((g) => (
                      <div key={g.category}>
                        <h3 className="text-[13px] font-bold text-[var(--m-muted)]">{g.category}</h3>
                        <ul className="mt-2 divide-y divide-[var(--m-rule)]">
                          {g.skills.map((s) => <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-[14.5px]"><span className="font-bold text-[var(--m-ink)]">{s.name}</span><span className="flex items-center gap-1" title={LEVEL_LABEL[s.level]}><span className="sr-only">{LEVEL_LABEL[s.level]}</span>{[1, 2, 3].map((n) => <span key={n} aria-hidden className={`h-1.5 w-5 rounded-full ${n <= LEVEL_BARS[s.level] ? "bg-[var(--m-ink)]" : "bg-[var(--m-rule)]"}`} />)}</span></li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {d.projects.length > 0 && (
                <Section id="projects" title="Projects">
                  <ul className="grid gap-5 sm:grid-cols-2">
                    {d.projects.map((p) => (
                      <li key={p.id} className="flex flex-col border-t-4 border-[var(--m-accent)] bg-[var(--m-ground)] p-5 print:break-inside-avoid">
                        <h3 className="font-lp-display text-[18px] font-bold leading-snug text-[var(--m-ink)]">{p.name}</h3>
                        {p.description && <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--m-muted)]">{p.description}</p>}
                        {p.skills.length > 0 && <p className="mt-3 text-[12.5px] font-bold text-[var(--m-ink)]">{p.skills.join(" · ")}</p>}
                        {p.url && <a href={href(p.url)} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline">View project<ExternalLink size={13} aria-hidden /></a>}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {d.certifications.length > 0 && (
                <Section id="certifications" title="Certifications">
                  <ul className="flex flex-col gap-3">{d.certifications.map((c) => <li key={c.id} className="grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-8"><span className="text-[13.5px] font-bold tabular-nums text-[var(--m-ink)]">{c.year ?? ""}</span><span className="text-[15px] text-[var(--m-ink)]"><span className="font-bold">{c.name}</span>{c.issuer && <span className="text-[var(--m-muted)]"> · {c.issuer}</span>}</span></li>)}</ul>
                </Section>
              )}

              {d.awards.length > 0 && (
                <Section id="awards" title="Awards and badges">
                  <ul className="flex flex-col gap-3">{d.awards.map((a) => <li key={`${a.title}-${a.year}`} className="grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-8"><span className="text-[13.5px] font-bold tabular-nums text-[var(--m-ink)]">{a.year ?? ""}</span><span className="text-[15px] text-[var(--m-ink)]"><span className="font-bold">{a.title}</span>{a.issuer && <span className="text-[var(--m-muted)]"> · {a.issuer}</span>}</span></li>)}</ul>
                </Section>
              )}

              {d.education.length > 0 && (
                <Section id="education" title="Education">
                  <ul className="flex flex-col gap-4">{d.education.map((e) => <li key={e.id} className="grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-8"><span className="text-[13.5px] font-bold tabular-nums text-[var(--m-ink)]">{e.startYear || e.endYear ? `${e.startYear ?? ""} – ${e.endYear ?? ""}` : ""}</span><span className="text-[15px]"><span className="block font-bold text-[var(--m-ink)]">{[e.degree, e.fieldOfStudy].filter(Boolean).join(", ") || e.institution}</span>{[e.degree, e.fieldOfStudy].filter(Boolean).length > 0 && <span className="text-[var(--m-muted)]">{e.institution}</span>}</span></li>)}</ul>
                  {d.languages.length > 0 && <p className="mt-6 text-[14px] text-[var(--m-muted)]"><span className="font-bold text-[var(--m-ink)]">Languages </span>{d.languages.join(" · ")}</p>}
                </Section>
              )}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
