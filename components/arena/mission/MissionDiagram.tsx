import type { Scene, SceneItem, Tone } from "@/lib/arena-challenges/missions/types";

const TONE: Record<Tone, string> = { ink: "text-[var(--m-ink)]", accent: "text-app-orange", good: "text-app-success", bad: "text-app-rose", muted: "text-app-muted", water: "text-app-blue" };
const cls = (t?: Tone) => TONE[t ?? "ink"];

function draw(it: SceneItem, i: number) {
  switch (it.k) {
    case "line":
      return <line key={i} x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} stroke="currentColor" className={cls(it.tone)} strokeWidth={it.w ?? 2} strokeDasharray={it.dash ? "4 4" : undefined} strokeLinecap="round" />;
    case "rect":
      return <rect key={i} x={it.x} y={it.y} width={it.w} height={it.h} rx={2} stroke="currentColor" fill={it.fill ? "currentColor" : "none"} fillOpacity={it.fill ? 0.18 : 0} className={cls(it.tone)} strokeWidth={1.75} />;
    case "circle":
      return <circle key={i} cx={it.x} cy={it.y} r={it.r} stroke="currentColor" fill={it.fill ? "currentColor" : "none"} fillOpacity={it.fill ? 0.85 : 0} className={cls(it.tone)} strokeWidth={1.75} />;
    case "poly":
      return <polygon key={i} points={it.pts.map((p) => p.join(",")).join(" ")} stroke="currentColor" fill={it.fill ? "currentColor" : "none"} fillOpacity={it.fill ? 0.7 : 0} className={cls(it.tone)} strokeWidth={it.w ?? 1.5} strokeLinejoin="round" />;
    case "text":
      return <text key={i} x={it.x} y={it.y} textAnchor={it.anchor ?? "middle"} fontSize={it.size ?? 11} className={`fill-current ${cls(it.tone)}`}>{it.text}</text>;
  }
}

/** The set-up, drawn from the current settings. Decorative for assistive tech beyond its caption: the values are all in the controls. */
export function MissionDiagram({ scene }: { scene: Scene }) {
  return (
    <figure className="rounded-lg border border-[var(--m-rule)] bg-white p-3">
      <figcaption className="px-1 pb-1 font-lp-body text-[12.5px] font-semibold text-[var(--m-ink)]">{scene.title}<span className="ml-2 font-normal text-app-muted">as last tested</span></figcaption>
      <svg viewBox={`0 0 ${scene.w} ${scene.h}`} role="img" aria-label={scene.title} className="h-auto w-full">{scene.items.map(draw)}</svg>
    </figure>
  );
}
