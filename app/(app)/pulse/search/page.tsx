import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { cleanQuery, MIN_QUERY, searchPulse } from "@/lib/pulse/search";
import { Avatar } from "@/components/pulse/Avatar";
import { FollowButton } from "@/components/pulse/FollowButton";
import { MentorBadge } from "@/components/pulse/MentorBadge";

export const metadata: Metadata = { title: "Search — Capabilio AI" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = cleanQuery((await searchParams).q ?? "");
  const { user } = await requireAuthedUser();
  const results = q.length >= MIN_QUERY ? await searchPulse(createServiceClient(), user.id, q, { people: 30, colleges: 15 }) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Search</h1>
      <form action="/pulse/search" className="mt-4 flex items-center gap-2 rounded-full border border-app-border bg-white px-4 focus-within:border-app-orange focus-within:ring-2 focus-within:ring-app-orange/20">
        <Search size={16} className="text-app-muted" aria-hidden="true" />
        <input name="q" defaultValue={q} autoFocus={!q} aria-label="Search people and colleges" placeholder="Search people and colleges…" className="w-full bg-transparent py-3 font-lp-body text-[14px] focus:outline-none" />
      </form>

      {!results ? (
        <p className="mt-8 text-center font-lp-body text-[13px] text-app-muted">Type at least {MIN_QUERY} letters of a name or a college.</p>
      ) : results.people.length === 0 && results.colleges.length === 0 ? (
        <p className="mt-8 text-center font-lp-body text-[13px] text-app-muted">No people or colleges match “{q}”. Check the spelling, or try fewer letters.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {results.people.length > 0 && (
            <section aria-label="People">
              <h2 className="mb-2 font-lp-body text-[13px] font-semibold text-app-muted">People</h2>
              <ul className="divide-y divide-app-border overflow-hidden rounded-2xl border border-app-border bg-white">
                {results.people.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <Link href={`/pulse/u/${p.id}`}><Avatar person={p} size="md" /></Link>
                    <div className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><Link href={`/pulse/u/${p.id}`} className="truncate font-lp-body text-[14px] font-semibold text-app-charcoal hover:underline">{p.name}</Link>{p.isMentor && <MentorBadge />}</span>
                      {p.tagline && <p className="truncate font-lp-body text-[12.5px] font-medium text-app-blue">{p.tagline}</p>}
                      <p className="truncate font-lp-body text-[12px] text-app-muted">{p.headline ?? "Capabilio member"}</p>
                    </div>
                    <FollowButton userId={p.id} initialFollowing={p.following} compact />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {results.colleges.length > 0 && (
            <section aria-label="Colleges">
              <h2 className="mb-2 font-lp-body text-[13px] font-semibold text-app-muted">Colleges</h2>
              <ul className="divide-y divide-app-border overflow-hidden rounded-2xl border border-app-border bg-white">
                {results.colleges.map((c) => (
                  <li key={c.id}>
                    <Link href={`/o/${c.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-app-background">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-app-orange-container text-app-orange"><Building2 size={18} aria-hidden="true" /></span>
                      <span className="min-w-0"><span className="block truncate font-lp-body text-[14px] font-semibold text-app-charcoal">{c.name}</span><span className="block truncate font-lp-body text-[12px] text-app-muted">{c.location ?? "College page"}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
