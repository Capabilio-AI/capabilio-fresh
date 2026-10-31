import Link from "next/link";
import { BadgeCheck, CalendarDays, ExternalLink, Globe, MapPin } from "lucide-react";
import type { PublicOrg, PublicPost } from "@/lib/org/public-org";
import { splitEvents } from "@/lib/org/events";
import { initialsOf } from "@/lib/org/format";
import { taglineOf } from "./CollegeHeader";
import { FollowButton, ShareButton } from "./SocialButtons";
import { FollowersButton } from "./FollowersList";
import { PostCard } from "./PostCard";
import { EmptyState } from "./ui";

export const PUBLIC_TABS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "events", label: "Events" },
] as const;
export type PublicTabId = (typeof PUBLIC_TABS)[number]["id"];

const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const plural = (n: number, word: string) => `${n.toLocaleString("en-IN")} ${word}${n === 1 ? "" : "s"}`;

/**
 * The college's public page, in the manner of a LinkedIn company page: banner, overlapping logo, name and tagline, one line of
 * facts, Follow, then Home / About / Events. A visitor sees followers and upcoming events only: no student counts, departments,
 * placement records or profile checklist (those belong to the college's own workspace).
 */
export function PublicCollegePage({ org, posts, tab, signedIn }: { org: PublicOrg; posts: PublicPost[]; tab: PublicTabId; signedIn: boolean }) {
  const { upcoming, past } = splitEvents(posts);
  const bio = org.profile?.bio;
  const tagline = taglineOf(org);
  const place = [org.city, org.state].filter(Boolean).join(", ");
  const cover = org.profile?.cover_image_url;
  const logo = org.profile?.logo_url;
  const base = `/o/${org.slug}`;
  const card = (p: PublicPost) => <PostCard key={p.id} post={p} slug={org.slug} orgName={org.name} logoUrl={logo ?? null} verified={org.verified} manage={false} />;

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
              {signedIn ? (
                <FollowButton slug={org.slug} following={org.isFollowing} followerCount={org.followerCount} />
              ) : (
                <Link href="/login" className="o-btn">Sign in to follow</Link>
              )}
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
              {place && (
                <>
                  <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden="true" /> {place}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <FollowersButton slug={org.slug} name={org.name} signedIn={signedIn} className="rounded-md font-semibold text-app-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-orange/40">
                {plural(org.followerCount, "follower")}
              </FollowersButton>
              <span aria-hidden="true">·</span>
              <Link href={`${base}?tab=events`} className="rounded-md font-semibold text-app-blue hover:underline">{plural(upcoming.length, "upcoming event")}</Link>
            </p>
          </div>

          <nav aria-label="College page sections" className="-mx-1 mt-4 flex gap-1 overflow-x-auto">
            {PUBLIC_TABS.map((t) => {
              const active = t.id === tab;
              return (
                <Link
                  key={t.id}
                  href={t.id === "home" ? base : `${base}?tab=${t.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`relative shrink-0 px-4 py-3 text-[14px] font-bold transition-colors ${active ? "text-app-charcoal" : "text-app-muted hover:text-app-charcoal"}`}
                >
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
          {tab === "home" &&
            (posts.length === 0 ? (
              <EmptyState title="No posts yet" body="Events and announcements from this college appear here." />
            ) : (
              posts.map(card)
            ))}

          {tab === "about" && (
            <section className="o-pub-card p-5 sm:p-6">
              <h2 className="text-[18px] font-extrabold text-app-charcoal">About</h2>
              {bio ? <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-relaxed text-app-charcoal">{bio}</p> : <p className="mt-3 text-[13.5px] text-app-muted">This college hasn&apos;t written an About section yet.</p>}
              <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 text-[13.5px] sm:grid-cols-2">
                <div>
                  <dt className="font-bold text-app-charcoal">Location</dt>
                  <dd className="mt-0.5 text-app-muted">{place || "Not listed"}</dd>
                </div>
                <div>
                  <dt className="font-bold text-app-charcoal">Founded</dt>
                  <dd className="mt-0.5 text-app-muted">{org.profile?.founded_year ?? "Not listed"}</dd>
                </div>
                <div>
                  <dt className="font-bold text-app-charcoal">Website</dt>
                  <dd className="mt-0.5">
                    {org.profile?.website_url ? (
                      <a href={org.profile.website_url} target="_blank" rel="noopener noreferrer" className="text-app-blue hover:underline">{org.profile.website_url.replace(/^https?:\/\//, "")}</a>
                    ) : (
                      <span className="text-app-muted">Not listed</span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {tab === "events" && (
            <>
              <h2 className="text-[18px] font-extrabold text-app-charcoal">Upcoming events</h2>
              {upcoming.length === 0 ? <EmptyState title="No upcoming events" body="Events this college publishes show up here." /> : upcoming.map(card)}
              {past.length > 0 && (
                <>
                  <h2 className="mt-2 text-[18px] font-extrabold text-app-charcoal">Past events</h2>
                  {past.map(card)}
                </>
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
            <h2 className="text-[15px] font-extrabold text-app-charcoal">Upcoming events</h2>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-[13px] text-app-muted">Nothing scheduled right now.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {upcoming.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <Link href={`${base}/posts/${e.id}`} className="group flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-app-orange-container text-center text-[10.5px] font-extrabold uppercase leading-tight text-app-orange">
                        {e.event_starts_at ? dayOf(e.event_starts_at) : <CalendarDays size={16} aria-hidden="true" />}
                      </span>
                      <span className="min-w-0 text-[13.5px] font-bold leading-snug text-app-charcoal group-hover:underline">{e.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {upcoming.length > 3 && <Link href={`${base}?tab=events`} className="mt-3 inline-block text-[13px] font-bold text-app-blue hover:underline">Show all {upcoming.length}</Link>}
          </section>
        </aside>
      </div>
    </main>
  );
}
