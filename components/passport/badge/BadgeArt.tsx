import { useId, type ReactNode } from "react";
import { BarChart3, Binary, Boxes, Brain, Bug, Cloud, Code2, Cpu, Database, FlaskConical, Gauge, GitBranch, Globe, Layers, Network, PenTool, Plug, Puzzle, Server, ShieldCheck, Smartphone, Workflow, type LucideIcon } from "lucide-react";
import type { BadgeLevel } from "@/lib/passport/badges";
import { badgeTheme, silhouettePath, type GlyphKey, type Pattern } from "./theme";

const GLYPHS: Record<GlyphKey, LucideIcon> = {
  code: Code2, api: Plug, database: Database, cloud: Cloud, network: Network, security: ShieldCheck, bug: Bug, design: PenTool, data: BarChart3, ai: Brain, devops: Workflow, git: GitBranch,
  algorithm: Binary, layers: Layers, puzzle: Puzzle, speed: Gauge, web: Globe, cpu: Cpu, server: Server, mobile: Smartphone, test: FlaskConical, tools: Code2, block: Boxes,
};

const INK = "#141414";
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const polar = (r: number, deg: number) => [60 + r * Math.sin((deg * Math.PI) / 180), 60 - r * Math.cos((deg * Math.PI) / 180)] as const;

/** The motif drawn across the face, in white at low strength so the palette carries the colour. All geometry, no images. */
function motif(p: Pattern): ReactNode {
  switch (p) {
    case "rays": return range(24).map((i) => { const [x, y] = polar(64, i * 15); return <path key={i} d={`M60 60 L${x.toFixed(1)} ${y.toFixed(1)}`} strokeWidth={i % 2 ? 1 : 2.4} />; });
    case "rings": return range(8).map((i) => <circle key={i} cx={60} cy={60} r={14 + i * 6} strokeWidth={i % 3 === 0 ? 2.2 : 1} fill="none" />);
    case "grid": return range(16).flatMap((i) => [<path key={`a${i}`} d={`M${-20 + i * 10} 0 L${40 + i * 10} 120`} strokeWidth={1} />, <path key={`b${i}`} d={`M${140 - i * 10} 0 L${80 - i * 10} 120`} strokeWidth={1} />]);
    case "waves": return range(9).map((i) => <path key={i} d={`M-5 ${14 + i * 12} q 16 -12 32 0 t 32 0 t 32 0 t 32 0`} strokeWidth={i % 2 ? 1 : 2} fill="none" />);
    case "dots": return range(11).flatMap((r) => range(11).map((c) => { const dx = c * 11 - 5; const dy = r * 11 - 5; const d = Math.hypot(dx - 60, dy - 60); return <circle key={`${r}-${c}`} cx={dx} cy={dy} r={Math.max(0.6, 3.4 - d / 22)} stroke="none" fill="currentColor" />; }));
    case "chevrons": return range(8).map((i) => <path key={i} d={`M10 ${112 - i * 12} L60 ${70 - i * 12} L110 ${112 - i * 12}`} strokeWidth={i % 2 ? 1.2 : 2.4} fill="none" />);
    case "orbits": return [0, 60, 120].map((deg) => <ellipse key={deg} cx={60} cy={60} rx={50} ry={19} transform={`rotate(${deg} 60 60)`} strokeWidth={1.6} fill="none" />);
    case "weave": return range(7).map((i) => <path key={i} d={`M60 ${60 - 10 - i * 7} L${70 + i * 7} 60 L60 ${70 + i * 7} L${50 - i * 7} 60 Z`} strokeWidth={i % 2 ? 1 : 2} fill="none" />);
  }
}

export interface BadgeArtProps {
  skillId: string;
  name: string;
  /** null draws the skill as not earned yet: a ghost medallion, optionally with a progress ring */
  level: BadgeLevel | null;
  size?: number;
  face?: "front" | "back";
  /** engraved on the back, for example "16 OCT 2026" */
  engraved?: { line1: string; line2: string };
  /** 0-1: how far the next badge is, drawn as a ring around a ghost medallion */
  progress?: number;
  className?: string;
}

const LEVEL_NUMBER: Record<BadgeLevel, number> = { Foundation: 1, Proficient: 2, Advanced: 3 };

/**
 * A collectible medallion. Silhouette, motif, palette and glyph come from the skill, the finish from the level: Foundation is matte enamel,
 * Proficient has a metal rim and a sheen, Advanced adds a holographic foil that moves with the pointer (--hx/--hy) and a specular glint (--gx/--gy).
 */
export function BadgeArt({ skillId, name, level, size = 96, face = "front", engraved, progress = 0, className }: BadgeArtProps) {
  const uid = useId().replace(/:/g, "");
  const t = badgeTheme(skillId, name);
  const Glyph = GLYPHS[t.glyph];
  const outer = silhouettePath(t.silhouette, 56);
  const inner = silhouettePath(t.silhouette, 48);
  const rad = (t.angle * Math.PI) / 180;
  const grad = { x1: 0.5 - Math.sin(rad) / 2, y1: 0.5 + Math.cos(rad) / 2, x2: 0.5 + Math.sin(rad) / 2, y2: 0.5 - Math.cos(rad) / 2 };
  const label = level ? `${name}, ${level} badge` : `${name}, not earned yet`;
  const tier = level ? LEVEL_NUMBER[level] : 0;

  if (!level) {
    const arc = Math.max(0, Math.min(1, progress));
    return (
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={label} className={className}>
        <path d={outer} fill="#f1f1ea" stroke="var(--m-soft)" strokeWidth={1.6} strokeDasharray="4 4" strokeLinejoin="round" />
        <circle cx={60} cy={60} r={27} fill="#e7e7df" />
        <Glyph x={44} y={44} width={32} height={32} color="#a9a99d" strokeWidth={1.8} aria-hidden />
        {arc > 0 && <circle cx={60} cy={60} r={36} fill="none" stroke="var(--m-accent)" strokeWidth={3.5} strokeLinecap="round" strokeDasharray={`${arc * 226} 226`} transform="rotate(-90 60 60)" />}
      </svg>
    );
  }

  if (face === "back") {
    return (
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`Back of the ${label}${engraved ? `, earned ${engraved.line1} ${engraved.line2}` : ""}`} className={className}>
        <defs>
          <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3a3a36" /><stop offset="0.5" stopColor="#1b1b19" /><stop offset="1" stopColor="#0c0c0b" /></linearGradient>
          <path id={`${uid}-ring`} d="M60 60 m-41 0 a41 41 0 1 1 82 0 a41 41 0 1 1 -82 0" />
        </defs>
        <path d={outer} fill={`url(#${uid}-metal)`} />
        <path d={outer} fill="none" stroke={t.palette.glyph} strokeOpacity={0.55} strokeWidth={1.4} />
        <path d={inner} fill="none" stroke={t.palette.glyph} strokeOpacity={0.25} strokeWidth={0.8} />
        <text fontSize={6.2} fill={t.palette.glyph} fillOpacity={0.8} className="font-lp-body" fontWeight={700}>
          <textPath href={`#${uid}-ring`} startOffset="0" textLength={254} lengthAdjust="spacing">VERIFIED BY CAPABILIO · EARNED, NOT CLAIMED ·</textPath>
        </text>
        <text x={60} y={46} textAnchor="middle" fontSize={6.4} letterSpacing={2.2} fill="#ffffff" fillOpacity={0.6} className="font-lp-body" fontWeight={700}>EARNED</text>
        <text x={60} y={63} textAnchor="middle" fontSize={engraved && engraved.line1.length > 6 ? 12.5 : 15} fill="#ffffff" className="font-lp-display" fontWeight={700}>{engraved?.line1 ?? "—"}</text>
        <text x={60} y={77} textAnchor="middle" fontSize={11} fill={t.palette.glyph} className="font-lp-display" fontWeight={700}>{engraved?.line2 ?? ""}</text>
        <text x={60} y={89} textAnchor="middle" fontSize={5.2} letterSpacing={1.6} fill="#ffffff" fillOpacity={0.45} className="font-lp-body" fontWeight={600}>NO. {t.serial}</text>
      </svg>
    );
  }

  const rim = tier === 1 ? [t.palette.rim, t.palette.rim] : tier === 2 ? ["#ffffff", t.palette.rim] : ["#fff7d6", t.palette.rim];
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={label} className={className} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`${uid}-face`} {...grad}><stop offset="0" stopColor={t.palette.a} /><stop offset="1" stopColor={t.palette.b} /></linearGradient>
        <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={rim[0]} /><stop offset="0.55" stopColor={t.palette.a} /><stop offset="1" stopColor={rim[1]} /></linearGradient>
        <linearGradient id={`${uid}-foil`} x1="0" y1="0" x2="1" y2="1">
          {["#ff6ad5", "#c774e8", "#94d0ff", "#8ff7d1", "#fff48f", "#ff9f7a", "#ff6ad5"].map((c, i) => <stop key={i} offset={i / 6} stopColor={c} />)}
        </linearGradient>
        <radialGradient id={`${uid}-glint`}><stop offset="0" stopColor="#ffffff" stopOpacity={0.75} /><stop offset="1" stopColor="#ffffff" stopOpacity={0} /></radialGradient>
        <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="1"><stop offset="0.2" stopColor="#ffffff" stopOpacity={0.5} /><stop offset="0.45" stopColor="#ffffff" stopOpacity={0} /><stop offset="0.8" stopColor="#ffffff" stopOpacity={0.14} /></linearGradient>
        <clipPath id={`${uid}-clip`}><path d={inner} /></clipPath>
      </defs>
      <path d={outer} fill={`url(#${uid}-rim)`} />
      <path d={outer} fill="none" stroke="#ffffff" strokeOpacity={tier === 1 ? 0.25 : 0.7} strokeWidth={1.2} strokeLinejoin="round" />
      <path d={inner} fill={`url(#${uid}-face)`} />
      <g clipPath={`url(#${uid}-clip)`}>
        <g stroke="#ffffff" strokeOpacity={0.26} color="#ffffff" fill="none" strokeLinecap="round">{motif(t.pattern)}</g>
        {tier >= 2 && <rect x={-10} y={-10} width={140} height={140} fill={`url(#${uid}-sheen)`} />}
        {tier === 3 && (
          <g style={{ mixBlendMode: "overlay", transform: "translate(calc(var(--hx, 0) * 1px), calc(var(--hy, 0) * 1px))" }}>
            <rect x={-70} y={-70} width={260} height={260} fill={`url(#${uid}-foil)`} opacity={0.75} />
          </g>
        )}
        <circle cx={60} cy={60} r={30} fill={`url(#${uid}-glint)`} opacity={0.9} style={{ transform: "translate(calc(var(--gx, -14) * 1px), calc(var(--gy, -18) * 1px))" }} />
      </g>
      <circle cx={60} cy={58} r={27} fill={INK} />
      <circle cx={60} cy={58} r={27} fill="none" stroke={t.palette.glyph} strokeOpacity={0.55} strokeWidth={1.2} />
      <Glyph x={44} y={42} width={32} height={32} color={t.palette.glyph} strokeWidth={2} aria-hidden />
      <g aria-hidden>
        {range(tier).map((i) => {
          const x = 60 + (i - (tier - 1) / 2) * 11;
          return <path key={i} d="M0 -4.6 L1.3 -1.4 L4.6 -1.3 L2 0.8 L2.9 4 L0 2 L-2.9 4 L-2 0.8 L-4.6 -1.3 L-1.3 -1.4 Z" fill="#ffffff" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" transform={`translate(${x} 95)`} />;
        })}
      </g>
    </svg>
  );
}
