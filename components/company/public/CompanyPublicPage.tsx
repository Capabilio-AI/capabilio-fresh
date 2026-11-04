import Link from "next/link";
import { BadgeCheck, Check, ExternalLink, Globe, MapPin } from "lucide-react";
import type { PublicCompany } from "@/lib/company/public";
import { factLine } from "@/lib/company/present";
import { EMPLOYMENT_LABEL, WORK_MODE_LABEL, paragraphs } from "@/lib/hiring/format";
import { initialsOf } from "@/lib/org/format";
import { taglineOf } from "@/components/org/CollegeHeader";
import { FollowButton, ShareButton } from "@/components/org/SocialButtons";
import { FollowersButton } from "@/components/org/FollowersList";
import { PostCard } from "@/components/org/PostCard";
import { EmptyState } from "@/components/org/ui";

export const COMPANY_TABS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "jobs", label: "Jobs" },
] as const;
export type CompanyTabId = (typeof COMPANY_TABS)[number]["id"];

const plural = (n: number, word: string) => `${n.toLocaleString("en-IN")} ${word}${n === 1 ? "" : "s"}`;

/** A company's public page, laid out exactly like the college page (banner, overlapping logo, Follow, Home / About / Jobs), on the same theme and components. */
export function CompanyPublicPage({ data, tab, signedIn }: { data: PublicCompany; tab: CompanyTabId; signedIn: boolean }) {
  const { org, extras, roles, posts } = data;
  const bio = org.profile?.bio;
  const tagline = taglineOf(org);
  const cover = org.profile?.cover_image_url;
  const logo = org.profile?.logo_url;
  const base = `/c/${org.slug}`;
  const facts = factLine({ industry: extras.industry, sizeBand: extras.sizeBand, city: org.city, foundedYear: null });
  const card = (p: (typeof posts)[number]) => <PostCard key={p.id} post={p} slug={org.slug} orgName={org.name} logoUrl={logo ?? null} verified={org.verified} manage={false} />;

  return (
    <main className="mx-auto max-w-[1128px] px-3 py-4 sm:px-5 sm:py-6">
      <section className="o-pub-card overflow-hidden" aria-label={`${org.name} page header`}>
        <div className="relative h-[132px] sm:h-[200px]" style={{ background: "linear-gradient(120deg,#fbefc9 0%,#f0c24f 55%,#d9962a 100%)" }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- picture uploaded to our own storage bucket
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true" className="pointer-events-none absolute -right-2 -top-8 select-none text-[220px] font-black leading-none tracking-[-0.06em] text-[#1e1707]/[0.07]">
              {initialsOf(org.name)}
            </span>
          )}
        </div>

        <div className="px-4 pb-0 sm:px-8">
          <div className="relative -mt-12 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:-mt-16">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- picture uploaded to our own storage bucket
              <img src={logo} alt={`${org.name} logo`} className="h-24 w-24 rounded-2xl bg-[#fff] object-cover shadow-[0_0_0_4px_#fff,0_2px_8px_rgb(60_40_0/0.18)] sm:h-32 sm:w-32" />
            ) : (
              <span className="o-logo-tile h-24 w-24 rounded-2xl text-[34px] shadow-[0_0_0_4px_#fff,0_2px_8px_rgb(60_40_0/0.18)] sm:h-32 sm:w-32 sm:text-[44px]" aria-hidden="true">
                {initialsOf(org.name)}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-2 pb-1">
              {signedIn ? <FollowButton slug={org.slug} following={org.isFollowing} followerCount={org.followerCount} /> : <Link href="/login" className="o-btn">Sign in to follow</Link>}
              {org.profile?.website_url && (
                <a href={org.profile.website_url} target="_blank" rel="noopener noreferrer" className="o-btn-ghost">
                  <Globe size={14} aria-hidden="true" /> Website <ExternalLink size={12} aria-hidden="true" />
                </a>
              )}
              <ShareButton path={base} />
            </div>
          </div>

          <div className="mt-3 min-w-0">
            <h1 className="flex flex-wrap items-center gap-x-2 text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-app-charcoal sm:text-[32px]">
              {org.name}
              {org.verified && (
                <span title="Reviewed and approved by the Capabilio team" className="inline-flex items-center gap-1 rounded-full bg-app-success-container px-2 py-0.5 text-[11px] font-bold tracking-normal text-app-success">
                  <BadgeCheck size={13} aria-hidden="true" /> Verified
                </span>
              )}
            </h1>
            {tagline && <p className="mt-1 max-w-2xl text-[15px] leading-snug text-app-charcoal/80">{tagline}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-app-muted">
              {facts.length > 0 && (
                <>
                  <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden="true" /> {facts.join(" · ")}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <FollowersButton slug={org.slug} name={org.name} signedIn={signedIn} className="rounded-md font-semibold text-app-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-orange/40">
                {plural(org.followerCount, "follower")}
              </FollowersButton>
              <span aria-hidden="true">·</span>
              <Link href={`${base}?tab=jobs`} className="rounded-md font-semibold text-app-blue hover:underline">{plural(roles.length, "open role")}</Link>
            </p>
          </div>

          <nav aria-label="Company page sections" className="-mx-1 mt-4 flex gap-1 overflow-x-auto">
            {COMPANY_TABS.map((t) => {
              const active = t.id === tab;
              return (
                <Link key={t.id} href={t.id === "home" ? base : `${base}?tab=${t.id}`} aria-current={active ? "page" : undefined} className={`relative shrink-0 px-4 py-3 text-[14px] font-bold transition-colors ${active ? "text-app-charcoal" : "text-app-muted hover:text-app-charcoal"}`}>
                  {t.label}
                  {active && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full" style={{ background: "var(--o-gradient)" }} />}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          {tab === "home" && (posts.length === 0 ? <EmptyState title="No posts yet" body="Updates, hiring news and milestones from this company appear here." /> : posts.map(card))}

          {tab === "about" && (
            <section className="o-pub-card p-5 sm:p-6">
              <h2 className="text-[18px] font-extrabold text-app-charcoal">About</h2>
              {extras.mission && <p className="mt-3 text-[15.5px] font-semibold leading-snug text-app-charcoal">{extras.mission}</p>}
              {bio ? <div className="mt-3 flex flex-col gap-3 text-[14.5px] leading-relaxed text-app-charcoal">{paragraphs(bio).map((p, i) => <p key={i}>{p}</p>)}</div> : <p className="mt-3 text-[13.5px] text-app-muted">This company hasn&apos;t written an About section yet.</p>}
              <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 text-[13.5px] sm:grid-cols-2">
                {[
                  ["Industry", extras.industry],
                  ["Company size", extras.sizeBand ? `${extras.sizeBand} people` : null],
                  ["Headquarters", org.city],
                  ["Founded", org.profile?.founded_year ? String(org.profile.founded_year) : null],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <dt className="font-bold text-app-charcoal">{k}</dt>
                    <dd className="mt-0.5 text-app-muted">{v || "Not listed"}</dd>
                  </div>
                ))}
                <div>
                  <dt className="font-bold text-app-charcoal">Website</dt>
                  <dd className="mt-0.5">{org.profile?.website_url ? <a href={org.profile.website_url} target="_blank" rel="noopener noreferrer" className="text-app-blue hover:underline">{org.profile.website_url.replace(/^https?:\/\//, "")}</a> : <span className="text-app-muted">Not listed</span>}</dd>
                </div>
              </dl>
              {extras.culture.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-[15px] font-extrabold text-app-charcoal">How we work</h3>
                  <ul className="mt-2 flex flex-col gap-1.5 text-[14px] text-app-charcoal">{extras.culture.map((c) => <li key={c}>{c}</li>)}</ul>
                </div>
              )}
              {extras.perks.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-[15px] font-extrabold text-app-charcoal">Perks</h3>
                  <ul className="mt-2 flex flex-col gap-1.5 text-[14px] text-app-charcoal">{extras.perks.map((c) => <li key={c} className="flex items-start gap-2"><Check size={15} aria-hidden="true" className="mt-[3px] shrink-0 text-app-success" />{c}</li>)}</ul>
                </div>
              )}
              {extras.techStack.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-[15px] font-extrabold text-app-charcoal">Tools and tech</h3>
                  <ul className="mt-2 flex flex-wrap gap-1.5">{extras.techStack.map((c) => <li key={c} className="rounded-full bg-app-orange-container px-3 py-1 text-[12.5px] font-semibold text-app-orange">{c}</li>)}</ul>
                </div>
              )}
            </section>
          )}

          {tab === "jobs" && (
            <>
              <h2 className="text-[18px] font-extrabold text-app-charcoal">Open roles</h2>
              {roles.length === 0 ? (
                <EmptyState title="No open roles" body={`Follow ${org.name} to see new roles in your feed first.`} />
              ) : (
                roles.map((r) => (
                  <Link key={r.id} href={`/launchpad#role-${r.id}`} className="o-pub-card block p-5 transition-colors hover:bg-app-background">
                    <h3 className="text-[16px] font-extrabold text-app-charcoal">{r.title}</h3>
                    <p className="mt-0.5 text-[13px] text-app-muted">{r.team} · {r.location} · {WORK_MODE_LABEL[r.workMode]} · {EMPLOYMENT_LABEL[r.employmentType]}{r.compensation ? ` · ${r.compensation}` : ""}</p>
                    <p className="mt-2 text-[14px] leading-relaxed text-app-charcoal">{r.summary}</p>
                    <span className="mt-3 inline-block text-[13px] font-bold text-app-blue">Apply with your Skill Passport</span>
                  </Link>
                ))
              )}
            </>
          )}
        </div>

        <aside className="flex flex-col gap-4" aria-label="Highlights">
          {tab !== "about" && bio && (
            <section className="o-pub-card p-5">
              <h2 className="text-[15px] font-extrabold text-app-charcoal">About</h2>
              <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-app-muted">{bio}</p>
              <Link href={`${base}?tab=about`} className="mt-2 inline-block text-[13px] font-bold text-app-blue hover:underline">See more</Link>
            </section>
          )}
          <section className="o-pub-card p-5">
            <h2 className="text-[15px] font-extrabold text-app-charcoal">Open roles</h2>
            {roles.length === 0 ? (
              <p className="mt-2 text-[13px] text-app-muted">Nothing open right now.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {roles.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <Link href={`/launchpad#role-${r.id}`} className="text-[13.5px] font-bold leading-snug text-app-charcoal hover:underline">{r.title}</Link>
                    <p className="text-[12px] text-app-muted">{r.location} · {EMPLOYMENT_LABEL[r.employmentType]}</p>
                  </li>
                ))}
              </ul>
            )}
            {roles.length > 3 && <Link href={`${base}?tab=jobs`} className="mt-3 inline-block text-[13px] font-bold text-app-blue hover:underline">Show all {roles.length}</Link>}
          </section>
        </aside>
      </div>
    </main>
  );
}
