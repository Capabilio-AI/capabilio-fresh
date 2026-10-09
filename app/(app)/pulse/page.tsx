import type { Metadata } from "next";
import Link from "next/link";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { profileCounts } from "@/lib/pulse/graph";
import { loadPeople } from "@/lib/pulse/people";
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
  const [people, counts] = await Promise.all([loadPeople(service, [user.id]), profileCounts(service, user.id)]);
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
