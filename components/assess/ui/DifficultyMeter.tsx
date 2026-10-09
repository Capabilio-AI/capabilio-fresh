import type { Difficulty } from "@/lib/assess/config";

const LEVEL: Record<Difficulty, number> = { EASY: 1, MEDIUM: 2, HARD: 3 };
const LABEL: Record<Difficulty, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };

/** Three rising bars + the word: signal-strength shorthand, readable without colour. */
export function DifficultyMeter({ difficulty }: { difficulty: Difficulty }) {
  const n = LEVEL[difficulty];
  return (
    <span className="a-glass-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-bold text-[var(--m-ink)]" title={`Difficulty: ${LABEL[difficulty]}`}>
      <span className="flex h-3.5 items-end gap-[3px]" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`w-[4px] rounded-sm ${i <= n ? "bg-[var(--m-ink)]" : "bg-[var(--m-soft)]"}`} style={{ height: `${4 + i * 3}px` }} />
        ))}
      </span>
      {LABEL[difficulty]}
    </span>
  );
}
