import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, FolderKanban, Swords, Trophy, Wrench } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getLeaderboard } from "@/lib/arena/data";
import { ArenaSubNav } from "@/components/arena/ArenaSubNav";

export const metadata: Metadata = { title: "Arena — Capabilio AI", description: "Execute, compete, and prove your skills." };

export default async function ArenaHubPage() {
  const { supabase, user } = await requireAuthedUser();

  const leaderboard = await getLeaderboard(supabase, user.id);
  const viewer = leaderboard.find((e) => e.isViewer);

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Arena</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        Where you execute — timed challenges, projects, and competitions that build proof.
      </p>
      <div className="mt-4">
        <ArenaSubNav />
      </div>

      <div className="grid grid-cols-1 gap-5 pt-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FeatureCard
              href="/arena/challenges"
              icon={Swords}
              title="Challenges"
              description="Weekly Stream and Domain challenges from your branch and chosen career."
              meta={viewer ? `Rating ${viewer.rating}` : "Not rated yet"}
            />
            <FeatureCard
              href="/arena/projects"
              icon={FolderKanban}
              title="Projects"
              description="Build real, scoped projects that become portfolio evidence."
              meta="In development"
            />
            <FeatureCard
              href="/arena/competitions"
              icon={Trophy}
              title="Competitions"
              description="Hackathons and datathons with teams and deadlines."
              meta="In development"
            />
          </div>

          <div className="rounded-xl border border-dashed border-app-border bg-white p-5">
            <div className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-muted">
              <Wrench size={13} />
              Building in Arena
            </div>
            <p className="mt-2 font-lp-body text-[13px] text-app-muted">
              Projects and Competitions are early — Challenges is fully live with a real ELO leaderboard below.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-app-border bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Trophy size={16} className="text-app-orange" />
            <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Leaderboard</h2>
          </div>
          {leaderboard.length === 0 ? (
            <p className="font-lp-body text-[13px] text-app-muted">
              No ratings yet — be the first to complete a challenge.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {leaderboard.slice(0, 8).map((entry) => (
                <div
                  key={entry.userId}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-2 ${entry.isViewer ? "bg-app-orange-container" : ""}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 font-lp-mono text-[11px] text-app-muted">{entry.rank}</span>
                    <span className="font-lp-body text-[13px] text-app-charcoal">
                      {entry.name ?? "Student"}
                      {entry.isViewer && " (you)"}
                    </span>
                  </div>
                  <span className="font-lp-mono text-[11px] font-semibold text-app-charcoal">{entry.rating}</span>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/arena/challenges"
            className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-app-border py-2.5 font-lp-body text-[12.5px] font-semibold text-app-charcoal hover:bg-app-background"
          >
            Start a challenge
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  href,
  icon: Icon,
  title,
  description,
  meta,
}: {
  href: string;
  icon: typeof Swords;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-3 rounded-xl border border-app-border bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-sm"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-background text-app-charcoal">
        <Icon size={18} />
      </span>
      <div>
        <h3 className="font-lp-body text-[14.5px] font-semibold text-app-charcoal">{title}</h3>
        <p className="mt-1 font-lp-body text-[12.5px] leading-relaxed text-app-muted">{description}</p>
      </div>
      <span className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">{meta}</span>
    </Link>
  );
}
