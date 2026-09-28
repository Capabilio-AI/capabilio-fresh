"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Compass, Layers, Loader2, XCircle } from "lucide-react";
import { SpinWheel } from "./SpinWheel";

interface ChallengeSummary {
  id: string;
  title: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  time_limit_minutes: number;
  scenario: string;
  objective: string;
  skill_tags: string[];
}
interface ChallengeDetail extends ChallengeSummary {
  language: string;
  starter_code: string | null;
  stdin: string | null;
}

type SlotState =
  | { id: string; status: "no_scope" }
  | { id: string; status: "ready_to_spin" }
  | { id: string; status: "active"; challenge?: ChallengeDetail }
  | { id: string; status: "cooldown"; cooldownUntil?: string };

interface TrackState {
  scopeKey: string | null;
  slots: SlotState[];
}

interface BoardData {
  stream: TrackState;
  domain: TrackState;
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

export function ArenaChallengesBoard() {
  const [data, setData] = useState<BoardData | null>(null);
  const [openChallenge, setOpenChallenge] = useState<{ slotId: string; challenge: ChallengeDetail } | null>(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    fetch("/api/arena/challenges")
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData({ stream: { scopeKey: null, slots: [] }, domain: { scopeKey: null, slots: [] } }));
  }

  async function spin(slotId: string) {
    const res = await fetch(`/api/arena/challenges/${slotId}/spin`, { method: "POST" });
    if (!res.ok) return;
    const { challenge } = await res.json();
    setOpenChallenge({ slotId, challenge });
    load();
  }

  if (!data) {
    return (
      <div className="flex justify-center rounded-xl border border-app-border bg-white py-16">
        <Loader2 size={22} className="animate-spin text-app-muted" />
      </div>
    );
  }

  if (openChallenge) {
    return (
      <ChallengeSolvePanel
        slotId={openChallenge.slotId}
        challenge={openChallenge.challenge}
        onDone={() => {
          setOpenChallenge(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <TrackSection title="Stream Challenges" icon={Layers} scopeLabel={data.stream.scopeKey} emptyHint="Add your branch in Education to unlock Stream challenges." track={data.stream} onSpin={spin} onOpen={setOpenChallenge} />
      <TrackSection title="Domain Challenges" icon={Compass} scopeLabel={data.domain.scopeKey} emptyHint="Tell us your target career during the assessment to unlock Domain challenges." track={data.domain} onSpin={spin} onOpen={setOpenChallenge} />
    </div>
  );
}

function TrackSection({
  title,
  icon: Icon,
  scopeLabel,
  emptyHint,
  track,
  onSpin,
  onOpen,
}: {
  title: string;
  icon: typeof Layers;
  scopeLabel: string | null;
  emptyHint: string;
  track: TrackState;
  onSpin: (slotId: string) => Promise<void>;
  onOpen: (v: { slotId: string; challenge: ChallengeDetail }) => void;
}) {
  return (
    <div className="rounded-xl border border-app-border bg-white p-5">
      <div className="flex items-center gap-2">
        <Icon size={17} className="text-app-charcoal" />
        <h2 className="font-lp-display text-[16px] font-semibold text-app-charcoal">{title}</h2>
        {scopeLabel && <span className="rounded-full bg-app-background px-2.5 py-0.5 font-lp-mono text-[11px] text-app-muted">{scopeLabel}</span>}
      </div>

      {!scopeLabel ? (
        <p className="mt-3 font-lp-body text-[13px] text-app-muted">{emptyHint}</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {track.slots.map((slot) => (
            <SlotCard key={slot.id} slot={slot} onSpin={() => onSpin(slot.id)} onOpen={() => slot.status === "active" && slot.challenge && onOpen({ slotId: slot.id, challenge: slot.challenge })} />
          ))}
        </div>
      )}
    </div>
  );
}

const DIFFICULTY_CLASS: Record<string, string> = {
  easy: "bg-app-success-container text-app-success",
  medium: "bg-app-warning-container text-app-warning",
  hard: "bg-app-attention-container text-app-attention",
};

function SlotCard({ slot, onSpin, onOpen }: { slot: SlotState; onSpin: () => Promise<void>; onOpen: () => void }) {
  if (slot.status === "cooldown") {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-app-border p-4 text-center">
        <Clock size={16} className="text-app-muted" />
        <p className="font-lp-mono text-[11px] text-app-muted">Next pick in {slot.cooldownUntil ? daysUntil(slot.cooldownUntil) : "—"} day(s)</p>
      </div>
    );
  }

  if (slot.status === "ready_to_spin") {
    return (
      <div className="rounded-lg border border-app-border p-3">
        <SpinWheel onSpin={onSpin} />
      </div>
    );
  }

  if (slot.status === "active" && slot.challenge) {
    return (
      <button type="button" onClick={onOpen} className="flex flex-col gap-2 rounded-lg border border-app-border p-4 text-left hover:border-app-charcoal/30 hover:shadow-sm">
        <span className={`w-fit rounded-full px-2 py-0.5 font-lp-mono text-[10px] font-semibold ${DIFFICULTY_CLASS[slot.challenge.difficulty]}`}>{slot.challenge.difficulty}</span>
        <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">{slot.challenge.title}</p>
        <p className="font-lp-mono text-[10.5px] text-app-muted">{slot.challenge.category} · ~{slot.challenge.time_limit_minutes}m</p>
      </button>
    );
  }

  return null;
}

function ChallengeSolvePanel({ slotId, challenge, onDone }: { slotId: string; challenge: ChallengeDetail; onDone: () => void }) {
  const [code, setCode] = useState(challenge.starter_code ?? "");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [output, setOutput] = useState<{ stdout: string; stderr: string } | null>(null);
  const [result, setResult] = useState<{ isCorrect: boolean; eloDelta: number } | null>(null);

  async function handleRun() {
    setRunning(true);
    setOutput(null);
    const res = await fetch("/api/code/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: challenge.language, code, stdin: challenge.stdin ?? "" }),
    });
    setRunning(false);
    if (!res.ok) {
      setOutput({ stdout: "", stderr: "Could not run code — try again." });
      return;
    }
    const data = await res.json();
    setOutput({ stdout: data.stdout ?? "", stderr: data.stderr || data.compileError || "" });
  }

  async function handleSubmit() {
    setSubmitting(true);
    const res = await fetch(`/api/arena/challenges/${slotId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setSubmitting(false);
    if (!res.ok) return;
    const data = await res.json();
    setResult({ isCorrect: data.isCorrect, eloDelta: data.eloDelta });
    setOutput({ stdout: data.stdout, stderr: data.stderr });
  }

  if (result) {
    return (
      <div className="rounded-xl border border-app-border bg-white p-6 text-center">
        {result.isCorrect ? <CheckCircle2 size={28} className="mx-auto text-app-success" /> : <XCircle size={28} className="mx-auto text-app-attention" />}
        <p className="mt-3 font-lp-display text-[18px] font-semibold text-app-charcoal">{result.isCorrect ? "Correct!" : "Not quite"}</p>
        {result.isCorrect && <p className="mt-1 font-lp-mono text-[12px] text-app-muted">+{result.eloDelta} rating</p>}
        <button type="button" onClick={onDone} className="mt-5 rounded-lg bg-app-charcoal px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white">
          Back to Challenges
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-app-border bg-white p-6">
      <span className={`w-fit rounded-full px-2 py-0.5 font-lp-mono text-[10px] font-semibold ${DIFFICULTY_CLASS[challenge.difficulty]}`}>{challenge.difficulty}</span>
      <h2 className="mt-2 font-lp-display text-[18px] font-semibold text-app-charcoal">{challenge.title}</h2>
      <p className="mt-2 font-lp-body text-[13px] leading-relaxed text-app-muted">{challenge.scenario}</p>
      <p className="mt-2 font-lp-body text-[13px] font-medium text-app-charcoal">{challenge.objective}</p>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        rows={10}
        className="mt-4 w-full resize-none rounded-lg border border-app-border bg-app-charcoal px-4 py-3 font-lp-mono text-[13px] leading-relaxed text-white focus:outline-none"
      />

      {output && (
        <div className="mt-3 rounded-lg border border-app-border bg-app-background px-4 py-3 font-lp-mono text-[12.5px]">
          <p className="text-app-muted">Output:</p>
          <pre className="mt-1 whitespace-pre-wrap text-app-charcoal">{output.stdout || "(no output)"}</pre>
          {output.stderr && <pre className="mt-1 whitespace-pre-wrap text-app-attention">{output.stderr}</pre>}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={handleRun} disabled={running} className="rounded-lg border border-app-border px-4 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal disabled:opacity-60">
          {running ? "Running…" : "Run"}
        </button>
        <button type="button" onClick={handleSubmit} disabled={submitting} className="rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-60">
          {submitting ? "Submitting…" : "Submit"}
        </button>
        <button type="button" onClick={onDone} className="ml-auto font-lp-mono text-[11px] text-app-muted hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
