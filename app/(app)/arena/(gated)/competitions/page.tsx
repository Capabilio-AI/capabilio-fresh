import type { Metadata } from "next";
import { Calendar, Users } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { ArenaSubNav } from "@/components/arena/ArenaSubNav";
import { AreaHero } from "@/components/metro/AreaHero";
import { MOCK_COMPETITIONS } from "@/lib/mock/arena";

export const metadata: Metadata = { title: "Competitions — Arena — Capabilio AI" };

export default async function ArenaCompetitionsPage() {
  const { supabase, user } = await requireAuthedUser();

  return (
    <div>
      <AreaHero tone="dark" title="Arena" intro="Timed challenges, projects, and competitions." nav={<ArenaSubNav />} />

      <div className="pt-5">
        <div className="mb-4 rounded-lg border border-dashed border-[var(--m-rule)] bg-white px-4 py-3 font-lp-body text-[12.5px] text-app-muted">
          Live competitions are in development — this preview shows the format.
        </div>
        {MOCK_COMPETITIONS.length === 0 ? (
          <p className="font-lp-body text-[13px] text-app-muted">No competitions open right now.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {MOCK_COMPETITIONS.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--m-rule)] bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h3 className="font-lp-body text-[14.5px] font-semibold text-[var(--m-ink)]">{c.title}</h3>
                  <p className="mt-0.5 font-lp-mono text-[11px] text-app-muted">{c.organizer}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.skills.map((s) => (
                      <span key={s} className="rounded-full border border-[var(--m-rule)] px-2 py-0.5 font-lp-mono text-[10.5px] text-app-muted">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1.5 font-lp-mono text-[11px] text-app-muted sm:items-end">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={12} />
                    Deadline {c.deadline}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users size={12} />
                    {c.teamSize}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
