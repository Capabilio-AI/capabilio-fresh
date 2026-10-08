import Link from "next/link";
import { Award, Building2, CalendarDays, CheckCircle2, ExternalLink, FileText, Code2, Hammer, Link2, MapPin } from "lucide-react";
import type { PulseAttachment } from "@/lib/pulse/data";
import { splitTags } from "@/lib/pulse/format";
import type { PostMeta } from "@/lib/pulse/post-schema";

function Text({ text, className = "" }: { text: string; className?: string }) {
  if (!text) return null;
  return (
    <p className={`whitespace-pre-wrap break-words font-lp-body text-[14px] leading-relaxed text-[var(--m-ink)] ${className}`}>
      {splitTags(text).map((part, i) => part.tag ? <Link key={i} href={`/pulse?tag=${part.tag}`} className="font-medium text-app-blue hover:underline">{part.text}</Link> : <span key={i}>{part.text}</span>)}
    </p>
  );
}

const chip = "rounded-full border border-[var(--m-rule)] px-2.5 py-0.5 font-lp-body text-[11.5px] text-app-muted";
const linkBtn = "inline-flex items-center gap-1.5 rounded-full border border-[var(--m-rule)] px-3 py-1.5 font-lp-body text-[12px] font-medium text-[var(--m-ink)] hover:bg-app-background";
const safe = (url: string) => /^https?:\/\//i.test(url);

export function sizeLabel(bytes: number): string {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function AttachmentCard({ file }: { file: PulseAttachment }) {
  return (
    <a href={file.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--m-rule)] bg-app-background px-4 py-3 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-orange/40">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-app-rose-container text-app-rose"><FileText size={18} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-lp-body text-[13px] font-semibold text-[var(--m-ink)]">{file.name}</span>
        <span className="block font-lp-mono text-[10.5px] text-app-muted">PDF{file.size ? ` · ${sizeLabel(file.size)}` : ""}</span>
      </span>
      <span className="flex items-center gap-1 font-lp-body text-[12px] font-medium text-app-blue">Open <ExternalLink size={12} aria-hidden="true" /></span>
    </a>
  );
}

/** The body of a post, laid out for what it is: an opportunity, a resource, a question, an achievement, or an update. */
export function PostBody({ kind, content, meta }: { kind: string; content: string; meta: PostMeta | null }) {
  if (meta?.kind === "project") {
    return (
      <div className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">{meta.title}</h3>
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-lp-body text-[11px] font-semibold ${meta.status === "shipped" ? "bg-app-success-container text-app-success" : "bg-app-warning-container text-app-warning"}`}>
            {meta.status === "shipped" ? <CheckCircle2 size={11} aria-hidden="true" /> : <Hammer size={11} aria-hidden="true" />} {meta.status === "shipped" ? "Shipped" : "Building"}
          </span>
        </div>
        <Text text={content} className="mt-2" />
        {meta.stack.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tech stack">{meta.stack.map((t) => <li key={t} className={`${chip} bg-app-blue-container/40 text-app-blue`}><Link href={`/pulse?tag=${encodeURIComponent(t)}`}>{t}</Link></li>)}</ul>}
        {(meta.repoUrl || meta.demoUrl) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {meta.repoUrl && safe(meta.repoUrl) && <a href={meta.repoUrl} target="_blank" rel="noopener noreferrer" className={linkBtn}><Code2 size={13} aria-hidden="true" /> Code</a>}
            {meta.demoUrl && safe(meta.demoUrl) && <a href={meta.demoUrl} target="_blank" rel="noopener noreferrer" className={linkBtn}><ExternalLink size={13} aria-hidden="true" /> Live demo</a>}
          </div>
        )}
      </div>
    );
  }
  if (meta?.kind === "opportunity") {
    const label = { job: "Job", internship: "Internship", referral: "Referral", freelance: "Freelance" }[meta.opportunityType];
    return (
      <div className="mt-3 rounded-xl bg-app-blue-container/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">{meta.title}</h3>
          <span className="rounded-full bg-app-blue-container px-2 py-0.5 font-lp-body text-[11px] font-semibold text-app-blue">{label}</span>
        </div>
        {(meta.company || meta.location) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-lp-body text-[12.5px] text-app-muted">
            {meta.company && <span className="flex items-center gap-1"><Building2 size={12} aria-hidden="true" /> {meta.company}</span>}
            {meta.location && <span className="flex items-center gap-1"><MapPin size={12} aria-hidden="true" /> {meta.location}</span>}
          </p>
        )}
        <Text text={content} className="mt-2" />
        {meta.skills.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Skills">{meta.skills.map((t) => <li key={t} className={`${chip} bg-white text-app-blue`}><Link href={`/pulse?tag=${encodeURIComponent(t)}`}>{t}</Link></li>)}</ul>}
        {meta.applyUrl && safe(meta.applyUrl) && <a href={meta.applyUrl} target="_blank" rel="noopener noreferrer nofollow" className={`${linkBtn} mt-3 bg-white`}><ExternalLink size={13} aria-hidden="true" /> Apply</a>}
      </div>
    );
  }
  if (meta?.kind === "resource") {
    return (
      <div className="mt-3">
        <a href={safe(meta.url) ? meta.url : undefined} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-3 rounded-xl border border-[var(--m-rule)] bg-app-background px-4 py-3 hover:bg-white">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-app-success-container text-app-success"><Link2 size={18} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-lp-display text-[15px] font-bold text-[var(--m-ink)]">{meta.title}</span>
            <span className="block truncate font-lp-mono text-[10.5px] text-app-muted">{meta.url.replace(/^https?:\/\//, "")}</span>
          </span>
          <ExternalLink size={14} className="shrink-0 text-app-blue" aria-hidden="true" />
        </a>
        <Text text={content} className="mt-2" />
        {meta.tags.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics">{meta.tags.map((t) => <li key={t} className={`${chip} bg-app-success-container/50 text-app-success`}><Link href={`/pulse?tag=${encodeURIComponent(t)}`}>{t}</Link></li>)}</ul>}
      </div>
    );
  }
  if (meta?.kind === "question") {
    return (
      <div className="mt-3">
        <h3 className="font-lp-display text-[18px] font-bold leading-snug text-[var(--m-ink)]">{meta.title}</h3>
        <Text text={content} className="mt-2" />
        {meta.tags.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics">{meta.tags.map((t) => <li key={t} className={`${chip} bg-app-warning-container/50 text-app-warning`}><Link href={`/pulse?tag=${encodeURIComponent(t)}`}>{t}</Link></li>)}</ul>}
      </div>
    );
  }
  if (meta?.kind === "achievement") {
    return (
      <div className="mt-3 flex gap-3 rounded-xl bg-app-success-container/40 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-app-success text-white"><Award size={20} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">{meta.title}</h3>
          {(meta.issuer || meta.achievedOn) && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 font-lp-body text-[12.5px] text-app-muted">
              {meta.issuer && <span>{meta.issuer}</span>}
              {meta.achievedOn && <span className="flex items-center gap-1"><CalendarDays size={11} aria-hidden="true" /> {new Date(`${meta.achievedOn}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
            </p>
          )}
          <Text text={content} className="mt-2" />
          {meta.proofUrl && safe(meta.proofUrl) && <a href={meta.proofUrl} target="_blank" rel="noopener noreferrer" className={`${linkBtn} mt-3 bg-white`}><Link2 size={13} aria-hidden="true" /> View proof</a>}
        </div>
      </div>
    );
  }
  return <Text text={content} className="mt-3" />;
}
