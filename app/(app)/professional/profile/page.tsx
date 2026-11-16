import type { Metadata } from "next";
import { Camera } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { requireStage } from "@/lib/stage/guard";
import { loadProfessional } from "@/lib/professional/data";
import { AboutForm } from "@/components/professional/home/AboutForm";
import { JobsEditor } from "@/components/professional/home/JobsEditor";
import { RecordsEditor, type Item } from "@/components/professional/home/RecordsEditor";
import { ProBanner } from "@/components/professional/home/ProBanner";
import { ProTabs } from "@/components/professional/home/ProTabs";
import { PhotoButton } from "@/components/professional/home/PhotoButton";
import { CoverUpload } from "@/components/profile/CoverUpload";

export const metadata: Metadata = { title: "Profile — Capabilio AI" };

const PANEL = "rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-7";
const H2 = "font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]";

/** Where a professional edits what others see: photo, cover, headline, about and jobs. */
export default async function ProfessionalProfile() {
  await requireStage(["professional"]);
  const { user } = await requireAuthedUser();
  const d = await loadProfessional(user.id);
  const name = d.name ?? "You";
  const line = [d.jobTitle, d.employer].filter(Boolean).join(" at ") || null;
  const maxMonth = new Date().toISOString().slice(0, 7);
  const fromResume = (s: string) => s === "resume";
  const certs: Item[] = d.certifications.map((c) => ({ id: c.id, primary: c.name, secondary: [c.issuer, c.year].filter(Boolean).join(", "), fromResume: fromResume(c.source) }));
  const edu: Item[] = d.education.map((e) => ({ id: e.id, primary: [e.degree, e.fieldOfStudy].filter(Boolean).join(", ") || e.institution, secondary: [[e.degree, e.fieldOfStudy].filter(Boolean).length ? e.institution : "", e.startYear || e.endYear ? `${e.startYear ?? ""} to ${e.endYear ?? ""}` : ""].filter(Boolean).join(" · "), fromResume: fromResume(e.source) }));
  const projects: Item[] = d.projects.map((p) => ({ id: p.id, primary: p.name, secondary: [p.description, p.skills.join(", ")].filter(Boolean).join(" · "), fromResume: fromResume(p.source) }));
  const links: Item[] = d.links.map((l) => ({ id: l.id, primary: l.label, secondary: l.url, fromResume: fromResume(l.source) }));
  return (
    <div className="flex flex-col gap-5">
      <ProTabs />
      <ProBanner name={name} line={line} coverUrl={d.coverUrl} avatarUrl={d.avatarUrl} coverControls={<CoverUpload hasCover={!!d.coverUrl} />} avatarControls={<PhotoButton hasPhoto={!!d.avatarUrl} />} />
      <p className="-mt-2 flex items-center gap-2 px-2 text-[13px] text-[var(--m-muted)]"><Camera size={14} aria-hidden />Photos are PNG, JPG or WebP and are resized for you.</p>
      <section aria-labelledby="about-h" className={PANEL}><h2 id="about-h" className={`${H2} mb-4`}>About you</h2><AboutForm initial={{ headline: d.headline ?? "", location: d.location ?? "", about: d.about ?? "" }} /></section>
      <section aria-labelledby="jobs-h" className={PANEL}><h2 id="jobs-h" className={`${H2} mb-4`}>Your jobs</h2><JobsEditor jobs={d.work} maxMonth={maxMonth} /></section>
      <section aria-labelledby="edu-h" className={PANEL}><h2 id="edu-h" className={`${H2} mb-4`}>Education</h2><RecordsEditor kind="education" items={edu} ready={d.recordsReady} /></section>
      <section aria-labelledby="cert-h" className={PANEL}><h2 id="cert-h" className={`${H2} mb-4`}>Certifications</h2><RecordsEditor kind="certification" items={certs} ready={d.recordsReady} /></section>
      <section aria-labelledby="proj-h" className={PANEL}><h2 id="proj-h" className={`${H2} mb-4`}>Projects</h2><RecordsEditor kind="project" items={projects} ready={d.recordsReady} /></section>
      <section aria-labelledby="links-h" className={PANEL}><h2 id="links-h" className={`${H2} mb-4`}>Links</h2><RecordsEditor kind="link" items={links} ready={d.recordsReady} /></section>
    </div>
  );
}
