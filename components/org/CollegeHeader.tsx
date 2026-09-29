import Link from "next/link";
import { BadgeCheck, Globe, MapPin, Users } from "lucide-react";
import type { PublicOrg } from "@/lib/org/public-org";
import { FollowButton, ShareButton } from "./SocialButtons";

export const TABS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "events", label: "Events" },
  { id: "placements", label: "Placements" },
  { id: "departments", label: "Departments" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "•";

/** First sentence of the About text, used as the tagline under the name. */
export function taglineOf(bio: string | null): string | null {
  if (!bio) return null;
  const first = bio.trim().split(/(?<=[.!?])\s/)[0];
  return first.length > 160 ? `${first.slice(0, 157)}…` : first;
}

export function CollegeHeader({ org, signedIn, tab }: { org: PublicOrg; signedIn: boolean; tab: TabId }) {
  const [first, ...rest] = org.name.trim().split(/\s+/);
  const place = [org.city, org.state].filter(Boolean).join(", ");
  const cover = org.profile?.cover_image_url;
  const tagline = taglineOf(org.profile?.bio ?? null);

  return (
    <>
      <div className="o-cover h-[200px] md:h-[280px]">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-supplied external URL, no fixed domain to whitelist
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        )}
        <span aria-hidden="true" className="pointer-events-none absolute -right-4 -top-10 select-none text-[280px] font-black leading-none tracking-[-0.06em] text-white/[0.05] md:text-[380px]">
          {initialsOf(org.name)}
        </span>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0a08] via-[#0b0a08]/30 to-transparent" />
      </div>

      <div className="mx-auto max-w-[1120px] px-4 sm:px-8">
        <header className="relative z-10 -mt-12 flex flex-wrap items-end gap-x-6 gap-y-4 md:-mt-16">
          <span className="o-logo-tile h-24 w-24 shrink-0 rounded-[28px] text-[34px] md:h-32 md:w-32 md:rounded-[34px] md:text-[44px]" aria-hidden="true">
            {initialsOf(org.name)}
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-[34px] font-black leading-[0.95] tracking-[-0.04em] text-app-charcoal md:text-[52px]">
              {first}
              {rest.length > 0 && (
                <>
                  {" "}
                  <span className="o-serif text-app-orange">{rest.join(" ")}</span>
                </>
              )}
            </h1>
            {tagline && <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-app-muted">{tagline}</p>}
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-app-muted">
              {org.verified && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-app-success/30 bg-app-success-container px-2.5 py-1 text-[11px] font-extrabold text-app-success" title="Reviewed and approved by the Capabilio team">
                  <BadgeCheck size={13} aria-hidden="true" /> Verified by Capabilio
                </span>
              )}
              {place && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} aria-hidden="true" /> {place}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users size={13} aria-hidden="true" /> {org.studentCount.toLocaleString("en-IN")} student{org.studentCount === 1 ? "" : "s"} on Capabilio
              </span>
              <span>{org.followerCount.toLocaleString("en-IN")} follower{org.followerCount === 1 ? "" : "s"}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {signedIn ? (
              <FollowButton slug={org.slug} following={org.isFollowing} followerCount={org.followerCount} />
            ) : (
              <Link href="/login" className="o-btn">
                Sign in to follow
              </Link>
            )}
            {org.profile?.website_url && (
              <a href={org.profile.website_url} target="_blank" rel="noopener noreferrer" className="o-btn-ghost">
                <Globe size={14} aria-hidden="true" /> Website
              </a>
            )}
            <ShareButton path={`/o/${org.slug}`} />
          </div>
        </header>

        <nav aria-label="College page sections" className="relative z-10 mt-7 flex gap-1 overflow-x-auto border-b border-app-border">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <Link
                key={t.id}
                href={t.id === "home" ? `/o/${org.slug}` : `/o/${org.slug}?tab=${t.id}`}
                aria-current={active ? "page" : undefined}
                className={`relative shrink-0 px-4 py-3 text-[13.5px] font-bold transition-colors ${active ? "text-app-charcoal" : "text-app-muted hover:text-app-charcoal"}`}
              >
                {t.label}
                {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full" style={{ background: "var(--o-gradient)" }} />}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
