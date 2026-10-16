"use client";

import { Check, Clock, Lock } from "lucide-react";
import clsx from "clsx";
import type { SprintView } from "@/lib/workplace/sprint-server";
import type { BoardSlot, SlotState } from "@/lib/workplace/sprint";
import { kindLabel } from "@/lib/workplace/kind-labels";

const STATE_TEXT: Record<SlotState, string> = { done: "Done", active: "In progress", next: "Ready to start", cooling: "Opens soon", locked: "Locked" };
const DIFFICULTY_TEXT = { easy: "Beginner", medium: "Intermediate", hard: "Advanced" } as const;

function whenOpens(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function Marker({ state, index }: { state: SlotState; index: number }) {
  const base = "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-lp-display text-[14px] font-bold";
  if (state === "done") return <span className={clsx(base, "border-[var(--m-accent)] bg-[var(--m-accent)] text-white")}><Check size={16} strokeWidth={3} aria-hidden /></span>;
  if (state === "active") return <span className={clsx(base, "border-[var(--m-accent)] bg-[var(--m-sheet)] text-[var(--m-accent-ink)] shadow-[0_0_0_5px_var(--m-accent-soft)]")}>{index + 1}</span>;
  if (state === "next") return <span className={clsx(base, "border-[var(--m-ink)] bg-[var(--m-sheet)] text-[var(--m-ink)]")}>{index + 1}</span>;
  if (state === "cooling") return <span className={clsx(base, "border-[var(--m-soft)] bg-[var(--m-sheet)] text-[var(--m-muted)]")}><Clock size={15} aria-hidden /></span>;
  return <span className={clsx(base, "border-[var(--m-rule)] bg-[var(--m-ground)] text-[var(--m-off)]")}><Lock size={14} aria-hidden /></span>;
}

function Slot({ slot }: { slot: BoardSlot }) {
  const kind = kindLabel(slot.kind);
  const known = slot.state === "done" || slot.state === "active";
  return (
    <li className="relative flex gap-3 md:flex-col md:gap-2.5">
      <Marker state={slot.state} index={slot.index} />
      <div className="min-w-0">
        <p className={clsx("font-lp-body text-[11.5px] font-bold", slot.state === "active" ? "text-[var(--m-accent-ink)]" : "text-[var(--m-muted)]")}>
          {STATE_TEXT[slot.state]}
          {slot.state === "cooling" && slot.availableAt ? ` · ${whenOpens(slot.availableAt)}` : ""}
        </p>
        <p className={clsx("mt-0.5 font-lp-body text-[13.5px] leading-snug", known ? "font-semibold text-[var(--m-ink)]" : "text-[var(--m-muted)]")}>
          {known ? slot.title : slot.state === "locked" ? "Unlocks after the previous ticket" : "Your next ticket"}
        </p>
        {known && (
          <p className="mt-1 font-lp-body text-[12px] text-[var(--m-muted)]">
            {[slot.areaName, kind, slot.difficulty ? DIFFICULTY_TEXT[slot.difficulty] : null].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </li>
  );
}

/** The week at the company: a story and five tickets joined by a line, so each task feels like part of a job and not a loose puzzle. */
export function SprintBoard({ sprint }: { sprint: SprintView }) {
  const { board } = sprint;
  return (
    <section aria-labelledby="sprint-h" className="mb-5 rounded-3xl border border-[var(--m-rule)] bg-[var(--m-sheet)] p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h3 id="sprint-h" className="font-lp-display text-[20px] font-bold tracking-tight text-[var(--m-ink)]">
            This week at {sprint.company}: {sprint.story.title}
          </h3>
          <p className="mt-1 max-w-xl font-lp-body text-[13.5px] leading-relaxed text-[var(--m-muted)]">{sprint.story.blurb}</p>
        </div>
        <p className="font-lp-body text-[13px] font-semibold text-[var(--m-ink)]">
          {board.completed} of {board.slots.length} tickets done{board.bonus > 0 ? ` · ${board.bonus} bonus` : ""}
        </p>
      </div>

      <div className="relative mt-6">
        <span aria-hidden className="absolute left-[18px] top-4 hidden h-0.5 bg-[var(--m-rule)] md:block md:w-[calc(100%-36px)]" />
        <span aria-hidden className="absolute left-[18px] top-4 hidden h-0.5 bg-[var(--m-accent)] md:block" style={{ width: `calc((100% - 36px) * ${Math.min(board.completed, board.slots.length - 1) / (board.slots.length - 1)})` }} />
        <ol aria-label="Tickets this week" className="grid grid-cols-1 gap-5 md:grid-cols-5 md:gap-4">
          {board.slots.map((slot) => (
            <Slot key={slot.index} slot={slot} />
          ))}
        </ol>
      </div>
    </section>
  );
}
