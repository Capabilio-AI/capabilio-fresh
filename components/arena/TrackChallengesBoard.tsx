"use client";

import { useEffect, useState } from "react";
import { Briefcase, Clock, Flame, Trophy } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { TrackWorkspaceView, type TrackState } from "./TrackWorkspaceView";
import { DomainWorkspace } from "./domain/DomainWorkspace";
import { ChallengeLeaderboard } from "./ChallengeLeaderboard";
import { DomainLeaderboard } from "./DomainLeaderboard";
import { ChallengeHistory } from "./ChallengeHistory";
import { DomainHistory } from "./DomainHistory";
import { ChallengeStreak } from "./ChallengeStreak";
import { ChallengeWheel } from "./ChallengeWheel";

const EMPTY_STATE: TrackState = { scopeKey: null, scopeLabel: null, challenges: [] };

type Tab = "workspace" | "leaderboard" | "streak" | "history";

/**
 * Shared Workspace/Leaderboard/Streak/History shell for one track. Every
 * fetch inside is track-scoped from the start (separate tables/endpoints for
 * Stream vs Domain) -- this component only decides which already-separate
 * child to render, it never mixes their data.
 */
export function TrackChallengesBoard({ track }: { track: "stream" | "domain" }) {
  const [tab, setTab] = useState<Tab>("workspace");
  const [data, setData] = useState<TrackState | null>(null);

  useEffect(() => {
    if (track !== "stream") return;
    load();
  }, [track]);

  // while the week's problems are still being written, check again every 10 seconds
  useEffect(() => {
    if (!data?.preparing) return;
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [data?.preparing]);

  function load() {
    fetch("/api/arena/challenges")
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(EMPTY_STATE));
  }

  return (
    <div>
      <div className="flex gap-1 rounded-lg border border-[var(--m-rule)] bg-white p-1">
        <TabButton active={tab === "workspace"} onClick={() => setTab("workspace")} icon={Briefcase} label="Workspace" />
        <TabButton active={tab === "leaderboard"} onClick={() => setTab("leaderboard")} icon={Trophy} label="Leaderboard" />
        <TabButton active={tab === "streak"} onClick={() => setTab("streak")} icon={Flame} label="Streak" />
        <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={Clock} label="History" />
      </div>

      <div className="pt-6">
        {tab === "workspace" &&
          (track === "domain" ? (
            <DomainWorkspace />
          ) : !data ? (
            <div className="flex justify-center py-16">
              <ThinkingOrb state="connecting" size={64} theme="light" />
            </div>
          ) : data.needsSpin ? (
            <ChallengeWheel onStart={load} />
          ) : (
            <TrackWorkspaceView state={data} emptyHint="Add your branch in Education to unlock Stream challenges." onRefresh={load} />
          ))}

        {tab === "leaderboard" && (track === "domain" ? <DomainLeaderboard /> : <ChallengeLeaderboard />)}
        {tab === "streak" && <ChallengeStreak track={track} />}
        {tab === "history" && (track === "domain" ? <DomainHistory /> : <ChallengeHistory />)}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Briefcase; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-4 py-2 font-lp-body text-[13px] font-semibold ${
        active ? "bg-app-orange-container text-app-orange" : "text-app-muted"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
