"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageUploadButton } from "@/components/org/ImageUploadButton";
import { SIZE_BANDS } from "@/lib/company/profile-schema";
import { linesToList } from "@/lib/hiring/format";

const INPUT = "w-full rounded-lg border border-[var(--m-rule)] bg-app-background px-3 py-2 font-lp-body text-[13px] text-[var(--m-ink)]";
const LABEL = "mb-1 block font-lp-body text-[12px] font-semibold text-[var(--m-ink)]";
const HINT = "mt-1 font-lp-body text-[11.5px] text-app-muted";
const BTN = "rounded-full px-4 py-1.5 font-lp-body text-[12.5px] font-semibold disabled:opacity-50";

export interface CompanyProfileValues {
  tagline: string;
  about: string;
  websiteUrl: string;
  foundedYear: string;
  city: string;
  isPublic: boolean;
  mission: string;
  industry: string;
  sizeBand: (typeof SIZE_BANDS)[number] | null;
  accent: string;
  culture: string[];
  perks: string[];
  techStack: string[];
}

/** The company's public page, edited. Every field is saved by /api/company/profile; the logo and cover go through the upload route, which attaches them. */
export function ProfileEditor({ values, companyName, slug, logoUrl, coverUrl }: { values: CompanyProfileValues; companyName: string; slug: string; logoUrl: string | null; coverUrl: string | null }) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(values.isPublic);
  const [accent, setAccent] = useState(values.accent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim() || null;
    const year = text("foundedYear");
    const body = {
      tagline: text("tagline"),
      about: text("about"),
      websiteUrl: text("websiteUrl"),
      foundedYear: year ? Number(year) : null,
      city: text("city"),
      isPublic,
      mission: text("mission"),
      industry: text("industry"),
      sizeBand: text("sizeBand"),
      accent,
      culture: linesToList(String(f.get("culture") ?? "")),
      perks: linesToList(String(f.get("perks") ?? "")),
      techStack: linesToList(String(f.get("techStack") ?? "")),
    };
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/company/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work.");
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <section aria-label="Brand" className="rounded-2xl border border-[var(--m-rule)] bg-[#fff] p-5">
        <h2 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Brand</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-[var(--m-rule)] bg-app-background font-lp-display text-[22px] font-bold text-[var(--m-ink)]">
            {logoUrl ? <Image src={logoUrl} alt={`${companyName} logo`} width={64} height={64} className="h-full w-full object-cover" unoptimized /> : companyName.slice(0, 1)}
          </span>
          <ImageUploadButton kind="logo" label="Upload logo" className={`${BTN} border border-[var(--m-soft)] bg-[var(--m-ground)] hover:bg-[var(--m-accent-soft)] text-[var(--m-ink)]`}>{logoUrl ? "Replace logo" : "Upload logo"}</ImageUploadButton>
          <ImageUploadButton kind="cover" label="Upload cover image" className={`${BTN} border border-[var(--m-soft)] bg-[var(--m-ground)] hover:bg-[var(--m-accent-soft)] text-[var(--m-ink)]`}>{coverUrl ? "Replace cover" : "Upload cover"}</ImageUploadButton>
        </div>
        {coverUrl && <Image src={coverUrl} alt="" width={1200} height={300} className="mt-4 h-32 w-full rounded-xl object-cover" unoptimized />}
        <div className="mt-4 flex items-center gap-3">
          <label htmlFor="accent" className={`${LABEL} mb-0`}>Accent colour</label>
          <input id="accent" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-[var(--m-rule)] bg-[#fff]" />
          <span className="font-lp-mono text-[12px] text-app-muted">{accent}</span>
        </div>
        <p className={HINT}>Used for your public page&apos;s highlights. Logo and cover are saved as soon as you upload them.</p>
      </section>

      <section aria-label="About" className="grid gap-4 rounded-2xl border border-[var(--m-rule)] bg-[#fff] p-5">
        <h2 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">About</h2>
        <div><label className={LABEL} htmlFor="tagline">Tagline</label><input id="tagline" name="tagline" maxLength={160} defaultValue={values.tagline} className={INPUT} /><p className={HINT}>One line, up to 160 characters.</p></div>
        <div><label className={LABEL} htmlFor="mission">Mission</label><textarea id="mission" name="mission" rows={3} maxLength={600} defaultValue={values.mission} className={INPUT} /></div>
        <div><label className={LABEL} htmlFor="about">About the company</label><textarea id="about" name="about" rows={6} maxLength={3000} defaultValue={values.about} className={INPUT} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={LABEL} htmlFor="industry">Industry</label><input id="industry" name="industry" maxLength={60} defaultValue={values.industry} className={INPUT} /></div>
          <div>
            <label className={LABEL} htmlFor="sizeBand">Company size</label>
            <select id="sizeBand" name="sizeBand" defaultValue={values.sizeBand ?? ""} className={INPUT}>
              <option value="">Not shown</option>
              {SIZE_BANDS.map((s) => <option key={s} value={s}>{s} people</option>)}
            </select>
          </div>
          <div><label className={LABEL} htmlFor="foundedYear">Founded</label><input id="foundedYear" name="foundedYear" type="number" min={1800} max={2100} defaultValue={values.foundedYear} className={INPUT} /></div>
          <div><label className={LABEL} htmlFor="city">Headquarters city</label><input id="city" name="city" maxLength={100} defaultValue={values.city} className={INPUT} /></div>
        </div>
        <div><label className={LABEL} htmlFor="websiteUrl">Website</label><input id="websiteUrl" name="websiteUrl" type="url" placeholder="https://" defaultValue={values.websiteUrl} className={INPUT} /></div>
      </section>

      <section aria-label="Culture" className="grid gap-4 rounded-2xl border border-[var(--m-rule)] bg-[#fff] p-5">
        <h2 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Culture and stack</h2>
        <div><label className={LABEL} htmlFor="culture">How you work (one per line, up to 8)</label><textarea id="culture" name="culture" rows={4} defaultValue={values.culture.join("\n")} className={INPUT} /></div>
        <div><label className={LABEL} htmlFor="perks">Perks (one per line, up to 12)</label><textarea id="perks" name="perks" rows={4} defaultValue={values.perks.join("\n")} className={INPUT} /></div>
        <div><label className={LABEL} htmlFor="techStack">Tools and tech (one per line, up to 20)</label><textarea id="techStack" name="techStack" rows={4} defaultValue={values.techStack.join("\n")} className={INPUT} /></div>
      </section>

      <section aria-label="Visibility" className="rounded-2xl border border-[var(--m-rule)] bg-[#fff] p-5">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>
            <span className="block font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">Make my company page public</span>
            <span className={HINT}>Anyone with the link can see it, and signed-in students can follow you. Turn it off to hide it again.</span>
          </span>
        </label>
        {isPublic && <p className="mt-3 font-lp-body text-[12.5px]">Your page: <Link href={`/c/${slug}`} target="_blank" className="font-semibold underline">/c/{slug}</Link></p>}
      </section>

      {error && <p role="alert" className="font-lp-body text-[12.5px] text-app-rose">{error}</p>}
      {saved && <p role="status" className="font-lp-body text-[12.5px] font-semibold text-[#17784a]">Saved.</p>}
      <div><button type="submit" disabled={busy} className={`${BTN} bg-app-charcoal text-[#fff]`}>{busy ? "Saving…" : "Save profile"}</button></div>
    </form>
  );
}
