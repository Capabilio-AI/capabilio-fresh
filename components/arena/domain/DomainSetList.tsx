import { Clock } from "lucide-react";
import { StartChallengeButton } from "../attempt/StartChallengeButton";
import type { DomainSetItem, ItemStatus } from "@/lib/arena-challenges/domain-set";

const STATUS_LABEL: Record<ItemStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  PASSED: "Passed",
  FAILED: "Failed",
  NEEDS_REVIEW: "Needs review",
};
const STATUS_CLASS: Record<ItemStatus, string> = {
  NOT_STARTED: "bg-app-border/60 text-app-muted",
  IN_PROGRESS: "bg-app-blue-container text-app-blue",
  PASSED: "bg-app-success-container text-app-success",
  FAILED: "bg-app-rose-container text-app-rose",
  NEEDS_REVIEW: "bg-app-orange-container text-app-orange",
};

/** Read-only list of the student's Domain set: difficulty, time, skills tested, status, ELO, and why each was chosen. */
export function DomainSetList({ items }: { items: DomainSetItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {items.map((item) => (
        <article key={item.id} className="flex flex-col rounded-3xl border border-[var(--m-rule)] bg-white p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="font-lp-mono text-[12px] font-bold uppercase tracking-wide text-app-blue">{`>_ ${item.difficulty}`}</span>
            <div className="flex items-center gap-1.5">
              {item.estMinutes != null && (
                <span className="flex items-center gap-1 rounded-full bg-app-border/50 px-2.5 py-1 font-lp-mono text-[11px] font-semibold text-[var(--m-ink)]/70">
                  <Clock size={11} />
                  {item.estMinutes}m
                </span>
              )}
              <span className="rounded-full bg-app-blue-container px-3 py-1 font-lp-body text-[12px] font-bold text-app-blue">+{item.eloAvailable} ELO</span>
            </div>
          </div>
          <h3 className="mt-5 font-lp-display text-[18px] font-bold leading-snug text-[var(--m-ink)]">{item.title}</h3>
          <p className="mt-2 font-lp-body text-[13px] leading-relaxed text-app-muted">{item.why}</p>
          {item.skills.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Skills tested">
              {item.skills.map((skill) => (
                <li key={skill.id} className="rounded-full border border-[var(--m-rule)] px-2.5 py-0.5 font-lp-body text-[11.5px] text-[var(--m-ink)]/80">
                  {skill.name}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex items-center justify-between gap-2 pt-5">
            <span className={`rounded-full px-3 py-1 font-lp-body text-[12px] font-semibold ${STATUS_CLASS[item.status]}`}>{STATUS_LABEL[item.status]}</span>
            {item.status === "PASSED" ? null : item.startable ? (
              <StartChallengeButton challengeId={item.id} label={item.status === "IN_PROGRESS" ? "Resume" : item.status === "FAILED" ? "Try again" : "Start"} />
            ) : (
              <span className="font-lp-body text-[12px] text-app-muted">Workstation not available yet</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
