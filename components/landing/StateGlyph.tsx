export type NodeState = "met" | "learning" | "none" | "check" | "locked";

export const STATE_LABEL: Record<NodeState, string> = {
  met: "Target met",
  learning: "Learning",
  none: "Not assessed",
  check: "Needs check",
  locked: "Locked",
};

/** One shape per state so status never rests on colour alone. */
export function StateGlyph({
  state,
  size = 16,
  ink = "currentColor",
  fill = "#fff",
}: {
  state: NodeState;
  size?: number;
  ink?: string;
  fill?: string;
}) {
  const c = 8;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      {state === "met" && (
        <>
          <circle cx={c} cy={c} r="7" fill={ink} />
          <path d="M4.8 8.2l2.2 2.2 4.2-4.6" fill="none" stroke={fill} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {state === "learning" && (
        <>
          <circle cx={c} cy={c} r="6.2" fill={fill} stroke={ink} strokeWidth="1.6" />
          <path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill={ink} />
        </>
      )}
      {state === "none" && (
        <circle cx={c} cy={c} r="6.2" fill={fill} stroke={ink} strokeWidth="1.6" strokeDasharray="2.4 2.2" />
      )}
      {state === "check" && (
        <>
          <path d="M8 1.2L15 8l-7 6.8L1 8z" fill={fill} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 5v3.6M8 10.6v.1" stroke={ink} strokeWidth="1.7" strokeLinecap="round" />
        </>
      )}
      {state === "locked" && (
        <>
          <circle cx={c} cy={c} r="6.2" fill={fill} stroke={ink} strokeWidth="1.6" />
          <path d="M4.6 8h6.8" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
