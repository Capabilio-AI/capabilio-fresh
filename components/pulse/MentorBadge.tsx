import { BadgeCheck } from "lucide-react";

/** Shown next to the name of a Capabilio-approved mentor. */
export function MentorBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-app-blue-container px-2 py-0.5 font-lp-body text-[10.5px] font-semibold text-app-blue ${className}`} title="Approved Capabilio mentor">
      <BadgeCheck size={11} aria-hidden="true" /> Mentor
    </span>
  );
}
