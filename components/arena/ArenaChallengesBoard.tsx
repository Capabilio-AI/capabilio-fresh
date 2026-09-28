"use client";

import { useEffect, useState } from "react";
import { Briefcase, Clock, GraduationCap, Loader2, Trophy } from "lucide-react";
import { TrackWorkspaceView, type TrackState } from "./TrackWorkspaceView";
import { ChallengeLeaderboard } from "./ChallengeLeaderboard";
import { ChallengeHistory } from "./ChallengeHistory";

interface BoardData {
  stream: TrackState;
  domain: TrackState;
}

const EMPTY_STATE: BoardData = {
  stream: { scopeKey: null, scopeLabel: null, challenges: [], nextChallengeId: null },
  domain: { scopeKey: null, scopeLabel: null, challenges: [], nextChallengeId: null },
};

type Tab = "workspace" | "leaderboard" | "history";

export function ArenaChallengesBoard() {
  const [tab, setTab] = useState<Tab>("workspace");
  const [track, setTrack] = useState<"stream" | "domain">("stream");
  const [data, setData] = useState<BoardData | null>(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    fetch("/api/arena/challenges")
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(EMPTY_STATE));
  }

  return (
    <div>
      <div className="flex gap-1 rounded-lg border border-app-border bg-white p-1">
        <TabButton active={tab === "workspace"} onClick={() => setTab("workspace")} icon={Briefcase} label="Workspace" />
        <TabButton active={tab === "leaderboard"} onClick={() => setTab("leaderboard")} icon={Trophy} label="Leaderboard" />
        <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={Clock} label="History" />
      </div>

      <div className="pt-6">
        {tab === "workspace" &&
          (!data ? (
            <div className="flex justify-center py-16">
              <Loader2 size={22} className="animate-spin text-app-muted" />
            </div>
          ) : (
            <div>
              <div className="mx-auto mb-5 flex w-fit gap-1 rounded-lg border border-app-border bg-white p-1">
                <button
                  type="button"
                  onClick={() => setTrack("stream")}
                  className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 font-lp-body text-[12.5px] font-semibold ${track === "stream" ? "bg-app-charcoal text-white" : "text-app-muted"}`}
                >
                  <GraduationCap size={13} />
                  Stream Challenges
                </button>
                <button
                  type="button"
                  onClick={() => setTrack("domain")}
                  className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 font-lp-body text-[12.5px] font-semibold ${track === "domain" ? "bg-app-charcoal text-white" : "text-app-muted"}`}
                >
                  <Briefcase size={13} />
                  Domain Challenges
                </button>
              </div>
              <TrackWorkspaceView
                track={track}
                state={track === "stream" ? data.stream : data.domain}
                emptyHint={
                  track === "stream"
                    ? "Add your branch in Education to unlock Stream challenges."
                    : "Tell us your target career during the assessment to unlock Domain challenges."
                }
                onRefresh={load}
              />
            </div>
          ))}

        {tab === "leaderboard" && <ChallengeLeaderboard />}
        {tab === "history" && <ChallengeHistory />}
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
