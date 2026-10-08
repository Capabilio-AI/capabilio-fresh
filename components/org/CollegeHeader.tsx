import Link from "next/link";
import { BadgeCheck, Camera, ExternalLink, Globe, MapPin, Pencil, Users } from "lucide-react";
import type { PublicOrg } from "@/lib/org/public-org";
import { initialsOf } from "@/lib/org/format";
import { FollowButton, ShareButton } from "./SocialButtons";
import { ImageUploadButton } from "./ImageUploadButton";

export const TABS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "events", label: "Events" },
  { id: "placements", label: "Placements" },
  { id: "departments", label: "Departments" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

/** The line under the name: the tagline when set, else the first sentence of About. */
export function taglineOf(org: Pick<PublicOrg, "profile">): string | null {
  const t = org.profile?.tagline?.trim();
  if (t) return t;
  const bio = org.profile?.bio?.trim();
  if (!bio) return null;
  const first = bio.split(/(?<=[.!?])\s/)[0];
  return first.length > 160 ? `${first.slice(0, 157)}…` : first;
}

export function CollegeHeader({
  org,
  signedIn,
  tab,
  basePath,
  canEditPage = false,
  workspace = false,
}: {
  org: PublicOrg;
  signedIn: boolean;
  tab: TabId;
  /** "/o/<slug>" for visitors, "/org/college" inside the workspace */
  basePath: string;
  canEditPage?: boolean;
  workspace?: boolean;
}) {
  const [first, ...rest] = org.name.trim().split(/\s+/);
  const place = [org.city, org.state].filter(Boolean).join(", ");
  const cover = org.profile?.cover_image_url;
  const logo = org.profile?.logo_url;
  const tagline = taglineOf(org);

  return (
    <>
      <div className={`o-cover h-[200px] md:h-[280px] ${workspace ? "rounded-[28px]" : ""}`}>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- picture uploaded to our own storage bucket
          <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        )}
        <span aria-hidden="true" className="pointer-events-none absolute -right-4 -top-10 select-none text-[280px] font-black leading-none tracking-[-0.06em] text-white/[0.05] md:text-[380px]">
          {initialsOf(org.name)}
        </span>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0a08] via-[#0b0a08]/30 to-transparent" />
        {canEditPage && (
          <div className="absolute right-4 top-4 z-10">
            <ImageUploadButton kind="cover" label="Change cover image" className="o-btn-ghost !bg-black/50 !text-[#fff] backdrop-blur">
              <Camera size={14} aria-hidden="true" /> {cover ? "Change cover" : "Add cover"}
            </ImageUploadButton>
          </div>
        )}
      </div>

      <div className={workspace ? "" : "mx-auto max-w-[1120px] px-4 sm:px-8"}>
        <header className={`relative z-10 flex flex-wrap items-end gap-x-6 gap-y-4 ${workspace ? "mt-5 px-1" : "-mt-12 md:-mt-16"}`}>
          <div className={`relative shrink-0 ${workspace ? "-mt-14 self-start md:-mt-20" : ""}`}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- picture uploaded to our own storage bucket
              <img src={logo} alt={`${org.name} logo`} className="h-24 w-24 rounded-[28px] bg-[#14110c] object-cover shadow-[0_0_0_4px_var(--o-ring,#0b0a08)] md:h-32 md:w-32 md:rounded-[34px]" />
            ) : (
              <span className="o-logo-tile h-24 w-24 rounded-[28px] text-[34px] md:h-32 md:w-32 md:rounded-[34px] md:text-[44px]" aria-hidden="true">
                {initialsOf(org.name)}
              </span>
            )}
            {canEditPage && (
              <span className="absolute -bottom-2 -right-2">
                <ImageUploadButton kind="logo" label="Change logo" className="o-btn-ghost !rounded-full !bg-[#1a160f] !p-2 !text-[#fff]">
                  <Camera size={14} aria-hidden="true" />
                </ImageUploadButton>
              </span>
            )}
          </div>
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
              {org.profile?.founded_year && <span>Est. {org.profile.founded_year}</span>}
              <span className="inline-flex items-center gap-1.5">
                <Users size={13} aria-hidden="true" /> {org.studentCount.toLocaleString("en-IN")} student{org.studentCount === 1 ? "" : "s"} on Capabilio
              </span>
              <span>
                {org.followerCount.toLocaleString("en-IN")} follower{org.followerCount === 1 ? "" : "s"}
              </span>
              {workspace && !org.profile?.is_public && <span className="rounded-full bg-app-warning-container px-2.5 py-1 text-[11px] font-bold text-app-warning">Not public yet</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {workspace ? (
              <>
                {canEditPage && (
                  <Link href="/org/college?edit=1" className="o-btn">
                    <Pencil size={14} aria-hidden="true" /> Edit page
                  </Link>
                )}
                <Link href={`/o/${org.slug}`} target="_blank" className="o-btn-ghost">
                  <ExternalLink size={14} aria-hidden="true" /> View as visitor
                </Link>
              </>
            ) : signedIn ? (
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
                href={t.id === "home" ? basePath : `${basePath}?tab=${t.id}`}
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
