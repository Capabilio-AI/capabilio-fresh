import { Check, X } from "lucide-react";
import { looksLikeCode } from "../ui/CodeText";

export const LETTERS = ["A", "B", "C", "D", "E", "F"];

export type OptionState = "idle" | "chosen" | "correct" | "wrong" | "dim";

export interface FeedbackLite {
  chosenIndex: number;
  correctIndex: number;
}

/** idle -> chosen (saving) -> correct | wrong | dim once the server has answered. */
export function optionState(i: number, selected: number | null, fb: FeedbackLite | null): OptionState {
  if (fb) return i === fb.correctIndex ? "correct" : i === fb.chosenIndex ? "wrong" : "dim";
  return i === selected ? "chosen" : "idle";
}

const SURFACE: Record<OptionState, string> = {
  idle: "a-glass-soft hover:border-white",
  chosen: "a-glass border-[var(--m-accent-ink)] ring-2 ring-[var(--m-accent-ink)]/60",
  correct: "border-[var(--ok)] bg-[var(--ok-soft)] text-[var(--ok-ink)] shadow-[0_16px_30px_-18px_var(--ok)]",
  wrong: "a-shake border-[var(--bad)] bg-[var(--bad-soft)] text-[var(--bad-ink)] shadow-[0_16px_30px_-18px_var(--bad)]",
  dim: "a-glass-soft opacity-55",
};

/**
 * One answer. Colour never works alone: the correct tile gets a check and the words "Correct answer", the wrong pick gets a cross
 * and "Your answer". Locked tiles are disabled for real (not just styled), so a second choice is impossible from the UI as well as
 * from the server.
 */
export function OptionTile({ index, text, state, locked, onPick }: { index: number; text: string; state: OptionState; locked: boolean; onPick: () => void }) {
  const code = looksLikeCode(text);
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={locked}
      aria-pressed={state === "chosen" || state === "wrong" || state === "correct" ? true : undefined}
      aria-keyshortcuts={`${LETTERS[index]} ${index + 1}`}
      className={`a-tile group flex w-full items-start gap-4 rounded-2xl border border-transparent px-4 py-4 text-left disabled:cursor-default sm:px-5 ${SURFACE[state]}`}
    >
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-[13px] font-bold transition-colors ${state === "correct" ? "border-[var(--ok)] bg-[var(--ok)] text-white" : state === "wrong" ? "border-[var(--bad)] bg-[var(--bad)] text-white" : "border-[var(--m-soft)] bg-white/70 text-[var(--m-ink)] group-hover:border-[var(--m-ink)]"}`} aria-hidden>
        {state === "correct" ? <Check className="h-4 w-4" strokeWidth={3} /> : state === "wrong" ? <X className="h-4 w-4" strokeWidth={3} /> : LETTERS[index]}
      </span>
      <span className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-[15.5px] leading-relaxed ${code ? "a-code" : ""} ${state === "idle" || state === "chosen" || state === "dim" ? "text-[var(--m-ink)]" : ""}`}>{text}</span>
      {state === "correct" && <span className="shrink-0 self-center text-[11.5px] font-bold uppercase tracking-wider">Correct answer</span>}
      {state === "wrong" && <span className="shrink-0 self-center text-[11.5px] font-bold uppercase tracking-wider">Your answer</span>}
    </button>
  );
}
