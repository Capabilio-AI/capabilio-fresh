import type { Metadata } from "next";
import Link from "next/link";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { profileCounts } from "@/lib/pulse/graph";
import { loadPeople } from "@/lib/pulse/people";
import { Avatar } from "@/components/pulse/Avatar";
import { ComingSoon } from "@/components/pulse/ComingSoon";
import { PulseFeed, type FeedView } from "@/components/pulse/PulseFeed";
import { PulseNav, type PulseTab } from "@/components/pulse/PulseNav";
import { PulseSidebar } from "@/components/pulse/PulseSidebar";

export const metadata: Metadata = { title: "Pulse — Capabilio AI", description: "Your network on Capabilio: what peers and mentors are building." };

const TABS = new Set<PulseTab>(["for-you", "following", "communities", "mentors"]);
const TAG = /^[A-Za-z][A-Za-z0-9_]{1,29}$/;

export default async function PulsePage({ searchParams }: { searchParams: Promise<{ tab?: string; tag?: string }> }) {
  const { tab: rawTab, tag } = await searchParams;
  const tab: PulseTab = TABS.has(rawTab as PulseTab) ? (rawTab as PulseTab) : "for-you";
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const [people, counts] = await Promise.all([loadPeople(service, [user.id]), profileCounts(service, user.id)]);
  const me = people.get(user.id) ?? { id: user.id, name: null, avatarUrl: null, headline: null, role: null };
  const viewer = { id: user.id, name: me.name, avatarUrl: me.avatarUrl };

  const view: FeedView = tag && TAG.test(tag) ? { mode: "tag", tag: tag.toLowerCase() } : tab === "following" ? { mode: "following" } : { mode: "for_you" };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
      <div className="hidden lg:block">
        <div className="sticky top-24 flex flex-col gap-4">
          <section className="rounded-2xl border border-app-border bg-white p-5" aria-label="Your profile">
            <Link href={`/pulse/u/${user.id}`} className="flex flex-col items-center text-center">
              <Avatar person={viewer} size="lg" />
              <span className="mt-3 font-lp-display text-[16px] font-semibold text-app-charcoal">{me.name ?? "You"}</span>
              <span className="mt-0.5 font-lp-body text-[12px] text-app-muted">{me.headline ?? "Add your college in Settings"}</span>
            </Link>
            <dl className="mt-4 grid grid-cols-3 gap-1 border-t border-app-border pt-4 text-center">
              {([["Posts", counts.posts], ["Followers", counts.followers], ["Following", counts.following]] as const).map(([label, n]) => (
                <div key={label}><dd className="font-lp-display text-[16px] font-semibold text-app-charcoal">{n}</dd><dt className="font-lp-body text-[10.5px] text-app-muted">{label}</dt></div>
              ))}
            </dl>
          </section>
          <PulseNav active={tab} variant="rail" />
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-4 lg:hidden"><PulseNav active={tab} variant="strip" /></div>
        <h1 className="sr-only">Pulse</h1>
        {tab === "communities" || tab === "mentors" ? <ComingSoon tab={tab} /> : <PulseFeed key={JSON.stringify(view)} view={view} viewer={viewer} />}
      </div>

      <div className="hidden xl:block"><div className="sticky top-24"><PulseSidebar /></div></div>
    </div>
  );
}
