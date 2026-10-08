import type { GraphNode } from "@/lib/roadmap-visual/graph-types";

type Status = GraphNode["status"];
const OFF = "#8795ab";
const INK = "currentColor";

/** A station on the line map. Shape carries the state (ring, half, filled, dashed, barred, struck), so colour is never the only signal. */
export function StationMark({ status, color = INK, resource = null, size = 22, next = false }: { status: Status; color?: string; resource?: "PROJECT" | "CERTIFICATION" | null; size?: number; next?: boolean }) {
  const dim = status === "LOCKED" || status === "SKIPPED";
  const c = dim ? OFF : color;
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden className="metro-station shrink-0 overflow-visible" style={{ color: "var(--m-ink)" }}>
      {next && <circle className="metro-pulse" cx="11" cy="11" r="9" fill="none" stroke={INK} strokeWidth="2" />}
      {resource === "PROJECT" && (<><rect x="2.5" y="2.5" width="17" height="17" rx="3" fill={c} /><rect x="8" y="8" width="6" height="6" rx="1" fill="#fff" /></>)}
      {resource === "CERTIFICATION" && (<><rect x="4" y="4" width="14" height="14" rx="2" fill={c} transform="rotate(45 11 11)" /><circle cx="11" cy="11" r="2.6" fill="#fff" /></>)}
      {!resource && (
        <>
          <circle cx="11" cy="11" r="8.5" fill={status === "LOCKED" ? "#eef2f7" : "#fff"} stroke={c} strokeWidth="3" strokeDasharray={status === "NOT_ASSESSED" ? "3.4 2.6" : undefined} />
          {status === "LEARNING" && <path d="M11 3.5a7.5 7.5 0 0 0 0 15z" fill={c} />}
          {status === "TARGET_MET" && (<><circle cx="11" cy="11" r="8.5" fill={c} /><path d="M6.8 11.3l3 3 5.4-6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></>)}
          {status === "NEEDS_CHECK" && (<><rect x="10" y="5.8" width="2" height="6.4" rx="1" fill={INK} /><circle cx="11" cy="14.9" r="1.25" fill={INK} /></>)}
          {status === "LOCKED" && (<><rect x="7.4" y="10" width="7.2" height="5.4" rx="1" fill={OFF} /><path d="M8.9 10V8.6a2.1 2.1 0 0 1 4.2 0V10" fill="none" stroke={OFF} strokeWidth="1.5" /></>)}
          {status === "SKIPPED" && <path d="M5.5 16.5l11-11" stroke={OFF} strokeWidth="2.2" strokeLinecap="round" />}
        </>
      )}
    </svg>
  );
}
