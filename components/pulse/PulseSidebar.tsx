import { Hash, UserPlus } from "lucide-react";
import { MOCK_PEOPLE_TO_FOLLOW, MOCK_TRENDING_TOPICS } from "@/lib/mock/pulse";

export function PulseSidebar() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-app-border bg-white p-5">
        <div className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-muted">
          <Hash size={13} />
          Trending
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {MOCK_TRENDING_TOPICS.map((topic) => (
            <span
              key={topic}
              className="rounded-full border border-app-border px-2.5 py-1 font-lp-body text-[12px] text-app-charcoal"
            >
              {topic}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-app-border bg-white p-5">
        <div className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-muted">
          <UserPlus size={13} />
          People to follow
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {MOCK_PEOPLE_TO_FOLLOW.map((person) => (
            <div key={person.id} className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-charcoal font-lp-display text-[11px] font-semibold text-white">
                {person.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-lp-body text-[12.5px] font-medium text-app-charcoal">{person.name}</p>
                <p className="truncate font-lp-mono text-[10.5px] text-app-muted">{person.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
