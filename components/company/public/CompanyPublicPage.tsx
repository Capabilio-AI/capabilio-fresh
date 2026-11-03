import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, Globe, MapPin } from "lucide-react";
import { accentFor, factLine, inkOn, POST_TYPE_LABEL } from "@/lib/company/present";
import type { PublicCompany } from "@/lib/company/public";
import { EMPLOYMENT_LABEL, paragraphs, WORK_MODE_LABEL } from "@/lib/hiring/format";
import { FollowButton, LikeButton } from "./PublicButtons";

const H2 = "font-cap-display text-[22px] font-semibold tracking-[-0.025em] text-[#0c1020]";
const MUTED = "font-cap-body text-[14px] leading-[1.6] text-[#555a70]";
const LINK_FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--co)]";

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** A company's public page: a calm product-company layout. The company's own accent colours its actions; everything else is the house ground and ink. */
export function CompanyPublicPage({ data, signedIn }: { data: PublicCompany; signedIn: boolean }) {
  const { org, extras, roles, posts } = data;
  const profile = org.profile;
  const accent = accentFor(extras.accent);
  const vars = { "--co": accent, "--co-ink": inkOn(accent) } as CSSProperties;
  const facts = factLine({ industry: extras.industry, sizeBand: extras.sizeBand, city: org.city, foundedYear: profile?.founded_year ?? null });
  const about = profile?.bio ? paragraphs(profile.bio) : [];
  const website = profile?.website_url ?? null;

  return (
    <div style={vars} className="min-h-screen bg-[#fafafb] font-cap-body text-[#0c1020]">
      <header className="sticky top-0 z-30 border-b border-[#e3e5ee] bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-5">
          <Link href="/" aria-label="Capabilio AI home" className={`rounded ${LINK_FOCUS}`}>
            <Image src="/brand/capabilio-logo.png" alt="Capabilio AI" width={1130} height={234} priority className="h-8 w-auto" />
          </Link>
          <Link href={signedIn ? "/dashboard" : "/login"} className={`rounded-full border border-[#d9dbe5] bg-white px-4 py-1.5 text-[13px] font-semibold hover:bg-[#f3f4fa] ${LINK_FOCUS}`}>
            {signedIn ? "Open Capabilio" : "Sign in"}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-5 pb-24 pt-6">
        <div className={`relative overflow-hidden rounded-2xl border border-[#e3e5ee] ${profile?.cover_image_url ? "h-44 sm:h-60" : "h-24 sm:h-32"}`} style={{ backgroundColor: "color-mix(in srgb, var(--co) 12%, #ffffff)" }}>
          {profile?.cover_image_url && <Image src={profile.cover_image_url} alt="" fill sizes="1120px" className="object-cover" unoptimized priority />}
        </div>

        <section aria-label={`${org.name} overview`} className="flex flex-col gap-5 px-1 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
            <span className="relative z-10 -mt-10 flex h-20 w-20 shrink-0 self-start items-center justify-center overflow-hidden rounded-2xl border-4 border-[#fafafb] bg-white font-cap-display text-[30px] font-bold text-[var(--co)] ring-1 ring-[#e3e5ee] sm:-mt-12 sm:h-24 sm:w-24">
              {profile?.logo_url ? <Image src={profile.logo_url} alt={`${org.name} logo`} width={96} height={96} className="h-full w-full object-cover" unoptimized /> : org.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 pb-1 sm:pt-4">
              <h1 className="font-cap-display text-[clamp(1.9rem,4.2vw,2.9rem)] font-semibold leading-[1.05] tracking-[-0.03em] [text-wrap:balance]">{org.name}</h1>
              {profile?.tagline && <p className="mt-1.5 max-w-[46ch] text-[16px] leading-[1.5] text-[#555a70]">{profile.tagline}</p>}
              {facts.length > 0 && <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#555a70]">{facts.map((f) => <li key={f}>{f}</li>)}</ul>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 pb-1">
            <FollowButton slug={org.slug} following={org.isFollowing} followerCount={org.followerCount} />
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer" className={`inline-flex h-10 items-center gap-2 rounded-full border border-[#d9dbe5] bg-white px-4 text-[14px] font-semibold hover:bg-[#f3f4fa] ${LINK_FOCUS}`}>
                <Globe size={15} aria-hidden /> {host(website)} <ArrowUpRight size={14} aria-hidden className="opacity-60" />
              </a>
            )}
          </div>
        </section>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-14">
            {(extras.mission || about.length > 0) && (
              <section aria-labelledby="about">
                <h2 id="about" className={H2}>About</h2>
                {extras.mission && <p className="mt-4 max-w-[34ch] font-cap-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-medium leading-[1.25] tracking-[-0.02em] text-[#0c1020] [text-wrap:balance]">{extras.mission}</p>}
                <div className={`mt-4 flex max-w-[68ch] flex-col gap-3 ${MUTED} !text-[15px]`}>{about.map((p, i) => <p key={i}>{p}</p>)}</div>
              </section>
            )}

            <section aria-labelledby="roles">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="roles" className={H2}>Open roles</h2>
                <span className="text-[13px] tabular-nums text-[#555a70]">{roles.length}</span>
              </div>
              {roles.length === 0 ? (
                <p className={`mt-3 max-w-[52ch] ${MUTED}`}>No roles are open right now. Follow {org.name} and you will see new ones in your feed first.</p>
              ) : (
                <ul className="mt-3 divide-y divide-[#e3e5ee] rounded-2xl border border-[#e3e5ee] bg-white">
                  {roles.map((r) => (
                    <li key={r.id}>
                      <Link href={`/jobs#role-${r.id}`} className={`group flex items-start justify-between gap-4 rounded-2xl p-5 transition-colors hover:bg-[#f7f7fb] ${LINK_FOCUS}`}>
                        <span className="min-w-0">
                          <span className="block text-[16px] font-semibold tracking-[-0.01em]">{r.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#555a70]">
                            <span>{r.team}</span>
                            <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden />{r.location} · {WORK_MODE_LABEL[r.workMode]}</span>
                            <span>{EMPLOYMENT_LABEL[r.employmentType]}</span>
                            {r.compensation && <span>{r.compensation}</span>}
                          </span>
                          <span className="mt-2 block max-w-[62ch] text-[14px] leading-[1.55] text-[#555a70]">{r.summary}</span>
                        </span>
                        <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-[var(--co)] transition-transform group-hover:translate-x-0.5">Apply <ArrowUpRight size={14} aria-hidden /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[12.5px] text-[#555a70]">Applying shares your Capabilio Skill Passport with {org.name}. Students apply from the Jobs tab.</p>
            </section>

            <section aria-labelledby="updates">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="updates" className={H2}>Updates</h2>
                <span className="text-[13px] tabular-nums text-[#555a70]">{posts.length}</span>
              </div>
              {posts.length === 0 ? (
                <p className={`mt-3 ${MUTED}`}>{org.name} has not posted yet.</p>
              ) : (
                <ol className="mt-3 flex flex-col gap-4">
                  {posts.slice(0, 20).map((p) => (
                    <li key={p.id}>
                      <article className="rounded-2xl border border-[#e3e5ee] bg-white p-5">
                        <header className="flex items-center gap-2 text-[12.5px] text-[#555a70]">
                          <span className="rounded-full bg-[color-mix(in_srgb,var(--co)_12%,#ffffff)] px-2.5 py-0.5 font-semibold text-[#0c1020]">{POST_TYPE_LABEL[p.type] ?? "Update"}</span>
                          <time dateTime={p.published_at ?? undefined}>{formatDate(p.published_at)}</time>
                        </header>
                        <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.01em]">{p.title}</h3>
                        <div className={`mt-2 flex max-w-[68ch] flex-col gap-2 ${MUTED} !text-[14.5px]`}>{paragraphs(p.body).map((t, i) => <p key={i}>{t}</p>)}</div>
                        {p.cover_image_url && <Image src={p.cover_image_url} alt="" width={900} height={450} className="mt-4 h-auto w-full rounded-xl border border-[#e3e5ee]" unoptimized />}
                        <footer className="mt-4"><LikeButton postId={p.id} liked={p.likedByViewer} count={p.likeCount} /></footer>
                      </article>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-8 lg:sticky lg:top-20 lg:self-start" aria-label="Company details">
            {extras.culture.length > 0 && (
              <section aria-labelledby="culture">
                <h2 id="culture" className={`${H2} !text-[17px]`}>How we work</h2>
                <ul className="mt-3 flex flex-col gap-2.5">{extras.culture.map((c) => <li key={c} className="text-[14px] leading-[1.5] text-[#2b3046]">{c}</li>)}</ul>
              </section>
            )}
            {extras.perks.length > 0 && (
              <section aria-labelledby="perks">
                <h2 id="perks" className={`${H2} !text-[17px]`}>Perks</h2>
                <ul className="mt-3 flex flex-col gap-2">{extras.perks.map((c) => <li key={c} className="flex items-start gap-2 text-[14px] text-[#2b3046]"><Check size={15} aria-hidden className="mt-[3px] shrink-0 text-[var(--co)]" />{c}</li>)}</ul>
              </section>
            )}
            {extras.techStack.length > 0 && (
              <section aria-labelledby="stack">
                <h2 id="stack" className={`${H2} !text-[17px]`}>Tools and tech</h2>
                <ul className="mt-3 flex flex-wrap gap-1.5">{extras.techStack.map((c) => <li key={c} className="rounded-full border border-[#e3e5ee] bg-white px-2.5 py-1 text-[12.5px] font-medium text-[#2b3046]">{c}</li>)}</ul>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
