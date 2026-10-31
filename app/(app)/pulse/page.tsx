import type { Metadata } from "next";
import Link from "next/link";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { profileCounts } from "@/lib/pulse/graph";
import { loadPeople } from "@/lib/pulse/people";
import { followedColleges } from "@/lib/pulse/connections";
import { Building2 } from "lucide-react";
import { Avatar } from "@/components/pulse/Avatar";
import { CommunitiesDirectory } from "@/components/pulse/CommunitiesDirectory";
import { MentorsHub } from "@/components/pulse/MentorsHub";
import { PulseFeed, type FeedView } from "@/components/pulse/PulseFeed";
import { PulseNav, type PulseTab } from "@/components/pulse/PulseNav";
import { PulseSidebar } from "@/components/pulse/PulseSidebar";
import { ProfileStats } from "@/components/pulse/ProfileStats";

export const metadata: Metadata = { title: "Pulse | Capabilio AI", description: "Your network on Capabilio: what peers and mentors are building." };

const TABS = new Set<PulseTab>(["for-you", "following", "trending", "communities", "mentors"]);
const TAG = /^[A-Za-z][A-Za-z0-9_]{1,29}$/;

export default async function PulsePage({ searchParams }: { searchParams: Promise<{ tab?: string; tag?: string }> }) {
  const { tab: rawTab, tag } = await searchParams;
  const tab: PulseTab = TABS.has(rawTab as PulseTab) ? (rawTab as PulseTab) : "for-you";
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const [people, counts, colleges] = await Promise.all([loadPeople(service, [user.id]), profileCounts(service, user.id), followedColleges(service, user.id)]);
  const me = people.get(user.id) ?? { id: user.id, name: null, avatarUrl: null, headline: null, role: null };
  const viewer = { id: user.id, name: me.name, avatarUrl: me.avatarUrl };

  const view: FeedView = tag && TAG.test(tag) ? { mode: "tag", tag: tag.toLowerCase() } : tab === "following" ? { mode: "following" } : tab === "trending" ? { mode: "trending" } : { mode: "for_you" };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
      <div className="hidden lg:block">
        <div className="sticky top-24 flex flex-col gap-4">
          <section className="overflow-hidden rounded-3xl border border-[var(--m-rule)] bg-white p-5 pt-0" aria-label="Your profile">
            <div aria-hidden className="-mx-5 h-16 bg-[var(--m-accent-soft)]" />
            <Link href={`/pulse/u/${user.id}`} className="-mt-8 flex flex-col items-center text-center">
              <Avatar person={viewer} size="lg" />
              <span className="mt-3 font-lp-display text-[16px] font-bold text-[var(--m-ink)]">{me.name ?? "You"}</span>
              {me.tagline && <span className="mt-0.5 font-lp-body text-[12.5px] font-medium text-app-blue">{me.tagline}</span>}
              <span className="mt-0.5 font-lp-body text-[12px] text-app-muted">{me.headline ?? "Student"}</span>
            </Link>
            <ProfileStats userId={user.id} name={me.name ?? "You"} counts={counts} />
            {colleges.length > 0 && (
              <div className="mt-4 border-t border-[var(--m-rule)] pt-3">
                <p className="font-lp-body text-[10.5px] font-semibold uppercase tracking-wide text-app-muted">Colleges you follow</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {colleges.slice(0, 4).map((c) => (
                    <li key={c.id}><Link href={`/o/${c.slug}`} className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-app-background"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-app-orange-container text-app-orange"><Building2 size={14} aria-hidden="true" /></span><span className="truncate font-lp-body text-[12.5px] font-medium text-[var(--m-ink)] group-hover:underline">{c.name}</span></Link></li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          <PulseNav active={tab} variant="rail" />
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-4 lg:hidden"><PulseNav active={tab} variant="strip" /></div>
        <h1 className="sr-only">Pulse</h1>
        {tab === "communities" ? <CommunitiesDirectory /> : tab === "mentors" ? <MentorsHub viewer={viewer} /> : <PulseFeed key={JSON.stringify(view)} view={view} viewer={viewer} />}
      </div>

      <div className="hidden xl:block"><div className="sticky top-24"><PulseSidebar /></div></div>
    </div>
  );
}
