import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Newspaper } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { requireStage } from "@/lib/stage/guard";
import { loadPulse, loadPros, type FeedView } from "@/lib/professional/pulse-server";
import { listMentorsForProfessional } from "@/lib/mentorship/server";
import { Composer } from "@/components/professional/pulse/Composer";
import { FollowButton } from "@/components/professional/pulse/FollowButton";
import { MentorsTab } from "@/components/professional/pulse/MentorsTab";
import { NotesTray } from "@/components/professional/pulse/NotesTray";
import { PostCard } from "@/components/professional/pulse/PostCard";
import { PulseNav, TABS, type PulseTab } from "@/components/professional/pulse/PulseNav";
import { ProAvatar } from "@/components/professional/pulse/ProAvatar";
import { loadProfessional } from "@/lib/professional/data";

export const metadata: Metadata = { title: "Pulse — Capabilio AI" };

const TAG = /^[a-z][a-z0-9_]{1,29}$/;
const EMPTY: Record<FeedView, string> = {
  everyone: "No one has posted yet. Share an update, a project, a resource, a question or an achievement.",
  following: "You are not following anyone with posts yet. Follow a few professionals from the list on the right.",
  trending: "Nothing is trending yet this week. Posts that get likes and comments rise here.",
  mine: "You have not posted yet.",
};

/** A network for working professionals only, laid out like the student Pulse: your card and a glass nav on the left, notes and the feed in the middle, people and news on the right. */
export default async function ProfessionalPulse({ searchParams }: { searchParams: Promise<{ tab?: string; tag?: string; q?: string }> }) {
  await requireStage(["professional"]);
  const { user } = await requireAuthedUser();
  const sp = await searchParams;
  const tab: PulseTab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as PulseTab) : "everyone";
  const tag = sp.tag && TAG.test(sp.tag) ? sp.tag : null;
  const q = (sp.q ?? "").slice(0, 80);
  const view: FeedView = tab === "mentors" ? "everyone" : tab;

  let data: Awaited<ReturnType<typeof loadPulse>> | null = null;
  try {
    data = await loadPulse(user.id, view, tab === "mentors" ? null : tag);
  } catch (e) {
    console.error("[professional/pulse] load failed:", (e as Error).message);
  }
  const [me, profile, mentors] = await Promise.all([
    loadPros([user.id]).then((m) => m.get(user.id)),
    loadProfessional(user.id).catch(() => null),
    tab === "mentors" ? listMentorsForProfessional(user.id, q).catch(() => []) : Promise.resolve([]),
  ]);
  if (!data || !me) return <p role="alert" className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-[14.5px] text-[var(--m-ink)]">Pulse could not load right now. Please try again in a moment.</p>;
  const now = new Date().toISOString();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_330px]">
      <aside className="hidden lg:block">
        <div className="sticky top-28 flex flex-col gap-4">
          <section aria-label="Your profile" className="overflow-hidden rounded-3xl border border-[var(--m-rule)] bg-white">
            <div className="relative h-20 bg-[var(--m-accent-soft)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- storage-hosted cover, arbitrary origin */}
              {profile?.coverUrl && <img src={profile.coverUrl} alt="" className="size-full object-cover" />}
            </div>
            <Link href="/professional/portfolio" className="-mt-9 flex flex-col items-center px-5 pb-1 text-center">
              <span className="rounded-full border-4 border-white bg-white"><ProAvatar name={me.name} url={me.avatarUrl} size={68} /></span>
              <span className="mt-2.5 font-lp-display text-[16px] font-bold text-[var(--m-ink)]">{me.name}</span>
              <span className="mt-0.5 text-[12.5px] leading-snug text-[var(--m-muted)]">{me.line}</span>
            </Link>
            <dl className="mt-3 grid grid-cols-3 gap-1 border-t border-[var(--m-rule)] px-4 py-4 text-center">
              {([["Posts", data.counts.posts], ["Following", data.counts.following], ["Followers", data.counts.followers]] as const).map(([l, n]) => <div key={l}><dd className="font-lp-display text-[16px] font-bold tabular-nums text-[var(--m-ink)]">{n}</dd><dt className="text-[10.5px] font-medium text-[var(--m-muted)]">{l}</dt></div>)}
            </dl>
          </section>
          <PulseNav active={tab} variant="rail" />
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <h1 className="sr-only">Pulse</h1>
        <div className="lg:hidden"><PulseNav active={tab} variant="strip" /></div>
        {tab === "mentors" ? (
          <MentorsTab mentors={mentors} query={q} />
        ) : (
          <>
            <NotesTray me={{ name: me.name, avatarUrl: me.avatarUrl }} notes={data.notes} now={now} />
            <Composer name={me.name} avatarUrl={me.avatarUrl} />
            {tag && <p className="flex items-center gap-2 text-[14px] text-[var(--m-ink)]">Showing <span className="font-bold">#{tag}</span><Link href={tab === "everyone" ? "/professional/pulse" : `/professional/pulse?tab=${tab}`} className="rounded-full border border-[var(--m-ink)] px-3 py-1 text-[12.5px] font-bold">Clear<span className="sr-only"> the tag filter</span></Link></p>}
            {data.posts.length === 0 ? <p className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-[14.5px] text-[var(--m-muted)]">{tag ? `No posts tagged #${tag} yet.` : EMPTY[view]}</p> : data.posts.map((p) => <PostCard key={p.id} post={p} now={now} />)}
          </>
        )}
      </div>

      <aside className="hidden xl:block">
        <div className="sticky top-28 flex flex-col gap-4">
          <section aria-labelledby="people-h" className="rounded-3xl border border-[var(--m-rule)] bg-white p-5">
            <h2 id="people-h" className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">People to follow</h2>
            {data.people.length === 0 ? <p className="mt-2 text-[13.5px] text-[var(--m-muted)]">No one else has joined yet.</p> : (
              <ul className="mt-3 space-y-3">{data.people.map((p) => <li key={p.id} className="flex items-center gap-3"><ProAvatar name={p.name} url={p.avatarUrl} size={36} /><div className="min-w-0 flex-1"><p className="truncate text-[14px] font-bold text-[var(--m-ink)]">{p.name}</p><p className="truncate text-[12.5px] text-[var(--m-muted)]">{p.line}</p></div><FollowButton userId={p.id} following={data.following.includes(p.id)} /></li>)}</ul>
            )}
          </section>
          <section aria-labelledby="trend-h" className="rounded-3xl border border-[var(--m-rule)] bg-white p-5">
            <h2 id="trend-h" className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Trending this week</h2>
            {data.trending.length === 0 ? <p className="mt-2 text-[13.5px] text-[var(--m-muted)]">Tags show up here once people use them.</p> : (
              <ul className="mt-3 space-y-2">{data.trending.map((t) => <li key={t.tag} className="flex items-baseline justify-between"><Link href={`/professional/pulse?tag=${t.tag}`} className="text-[14px] font-bold text-[var(--m-accent-ink)] hover:underline">#{t.tag}</Link><span className="text-[12.5px] tabular-nums text-[var(--m-muted)]">{t.count} {t.count === 1 ? "post" : "posts"}</span></li>)}</ul>
            )}
          </section>
          <section aria-labelledby="news-h" className="rounded-3xl border border-[var(--m-rule)] bg-white p-5">
            <h2 id="news-h" className="flex items-center gap-2 font-lp-display text-[17px] font-bold text-[var(--m-ink)]"><Newspaper size={16} aria-hidden />Industry news</h2>
            {data.news.length === 0 ? <p className="mt-2 text-[13.5px] text-[var(--m-muted)]">Stories about your skills show up here. Add skills on your Skill graph.</p> : (
              <ul className="mt-3 space-y-3">{data.news.map((n) => <li key={n.id}><a href={n.url} target="_blank" rel="noopener noreferrer" className="group block"><span className="line-clamp-2 text-[13.5px] font-bold leading-snug text-[var(--m-ink)] group-hover:underline">{n.title}</span><span className="mt-0.5 flex items-center gap-1 text-[12px] text-[var(--m-muted)]">{n.source}<ExternalLink size={11} aria-hidden /></span></a></li>)}</ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
