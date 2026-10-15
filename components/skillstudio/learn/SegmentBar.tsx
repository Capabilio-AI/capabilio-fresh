import type { ModuleTopic } from "@/lib/skillstudio/modules";

const MAX_SEGMENTS = 24;

/** One segment per lesson: solid when proven, half when marked Learning, empty otherwise. Reads as a count, not a feeling. */
export function SegmentBar({ topics, color }: { topics: readonly ModuleTopic[]; color: string }) {
  const shown = topics.slice(0, MAX_SEGMENTS);
  const proven = topics.filter((t) => t.status === "TARGET_MET").length;
  return (
    <div className="flex gap-1" role="img" aria-label={`${proven} of ${topics.length} lessons proven`}>
      {shown.map((t, i) => {
        const on = t.status === "TARGET_MET";
        const half = !on && (t.userState === "LEARNING" || t.status === "LEARNING");
        return (
          <span key={t.key} className="relative h-1.5 min-w-1 flex-1 overflow-hidden rounded-full bg-[var(--m-rule)]">
            {(on || half) && <span className="ss-seg-fill absolute inset-0 rounded-full" style={{ background: color, opacity: on ? 1 : 0.45, animationDelay: `${i * 40}ms` }} />}
          </span>
        );
      })}
    </div>
  );
}
