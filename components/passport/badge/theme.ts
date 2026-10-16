import { hashSeed } from "@/lib/workplace/rng";

/** The silhouette of a medallion, as a polar radius function: one family of shapes, many different outlines. */
export type Silhouette =
  | { kind: "rosette"; lobes: number; depth: number }
  | { kind: "poly"; sides: number; round: number; turn: number }
  | { kind: "squircle"; power: number }
  | { kind: "burst"; points: number; depth: number };

export const PATTERNS = ["rays", "rings", "grid", "waves", "dots", "chevrons", "orbits", "weave"] as const;
export type Pattern = (typeof PATTERNS)[number];

export interface Palette {
  name: string;
  /** face gradient, light to deep */
  a: string;
  b: string;
  /** the glyph and pips on the dark centre */
  glyph: string;
  /** the rim, a deeper tone of the same hue */
  rim: string;
}

/** Vivid duotones, each a different hue family so neighbours on the wall never look alike. */
export const PALETTES: readonly Palette[] = [
  { name: "Volt", a: "#e8ff5a", b: "#7bd400", glyph: "#e8ff5a", rim: "#3d6b00" },
  { name: "Ultraviolet", a: "#a78bfa", b: "#5b21b6", glyph: "#c4b5fd", rim: "#2e1065" },
  { name: "Bubblegum", a: "#ff9ec4", b: "#e11d74", glyph: "#ffc2dc", rim: "#7a0b3d" },
  { name: "Lagoon", a: "#5eead4", b: "#0891b2", glyph: "#99f6e4", rim: "#064e5e" },
  { name: "Solar", a: "#ffd23f", b: "#ff5701", glyph: "#ffe08a", rim: "#8a2c00" },
  { name: "Orchid", a: "#f0abfc", b: "#a21caf", glyph: "#f5d0fe", rim: "#4a044e" },
  { name: "Cobalt", a: "#93c5fd", b: "#1d4ed8", glyph: "#bfdbfe", rim: "#172554" },
  { name: "Coral", a: "#fdba74", b: "#dc2626", glyph: "#fed7aa", rim: "#7f1d1d" },
  { name: "Jade", a: "#86efac", b: "#047857", glyph: "#bbf7d0", rim: "#064e3b" },
  { name: "Ice", a: "#e0f2fe", b: "#38bdf8", glyph: "#e0f2fe", rim: "#0c4a6e" },
];

export type GlyphKey = "code" | "api" | "database" | "cloud" | "network" | "security" | "bug" | "design" | "data" | "ai" | "devops" | "git" | "algorithm" | "layers" | "puzzle" | "speed" | "web" | "cpu" | "server" | "mobile" | "test" | "tools" | "block";

/** What a skill is about, read from its name, so the centre of each badge says something real. The first match wins. */
const GLYPH_RULES: readonly (readonly [RegExp, GlyphKey])[] = [
  [/error|exception|debug|bug|troubleshoot/i, "bug"],
  [/\bapi\b|rest|http|graphql|endpoint|integration/i, "api"],
  [/database|sql|query|schema|data model|nosql|storage/i, "database"],
  [/cloud|aws|azure|gcp|serverless|lambda/i, "cloud"],
  [/network|tcp|dns|protocol|routing/i, "network"],
  [/secur|auth|crypt|vulnerab|privacy|access/i, "security"],
  [/test|quality|qa\b|verif/i, "test"],
  [/design|\bui\b|\bux\b|css|layout|figma|visual design|typograph/i, "design"],
  [/analy|statist|visuali|dashboard|excel|spreadsheet|report|\bbi\b|data (clean|prep)/i, "data"],
  [/\bai\b|\bml\b|machine learning|neural|model|deep learning|nlp/i, "ai"],
  [/devops|\bci\b|\bcd\b|deploy|docker|kubern|pipeline|infrastructure|container|terraform/i, "devops"],
  [/\bgit\b|version control|branch/i, "git"],
  [/algorithm|complexity|sorting|recurs|graph|dynamic programming/i, "algorithm"],
  [/object|\boop\b|class|design pattern|architect|system design|modular/i, "layers"],
  [/problem|logic|reasoning|thinking/i, "puzzle"],
  [/perform|optimi[sz]|cach|scal|latency|efficien/i, "speed"],
  [/web|html|browser|frontend|front-end|react|dom\b/i, "web"],
  [/operating|linux|kernel|process|memory|embedded|hardware|systems?\b/i, "cpu"],
  [/server|backend|back-end|node|django|spring/i, "server"],
  [/mobile|android|ios|flutter/i, "mobile"],
  [/program|coding|language|python|java|javascript|typescript|c\+\+|syntax|fundamental|software/i, "tools"],
];
const FALLBACK_GLYPHS: readonly GlyphKey[] = ["block", "puzzle", "layers", "tools"];

export interface BadgeTheme {
  silhouette: Silhouette;
  pattern: Pattern;
  palette: Palette;
  glyph: GlyphKey;
  /** the angle of the face gradient, degrees */
  angle: number;
  /** a short mark engraved on the back so no two badges share one */
  serial: string;
}

/** Pure and deterministic: the same skill always gets the same badge, and different skills almost never share one. */
export function badgeTheme(skillId: string, name: string): BadgeTheme {
  const h = hashSeed("badge", skillId, name.toLowerCase());
  const slice = (shift: number, n: number) => (Math.abs((h >>> shift) | ((h << (32 - shift)) >>> 0)) >>> 0) % n;

  const silhouettes: Silhouette[] = [
    { kind: "rosette", lobes: 12, depth: 0.045 },
    { kind: "rosette", lobes: 8, depth: 0.06 },
    { kind: "rosette", lobes: 16, depth: 0.035 },
    { kind: "poly", sides: 6, round: 0.45, turn: 0 },
    { kind: "poly", sides: 8, round: 0.5, turn: Math.PI / 8 },
    { kind: "poly", sides: 5, round: 0.5, turn: Math.PI },
    { kind: "poly", sides: 4, round: 0.55, turn: Math.PI / 4 },
    { kind: "squircle", power: 4 },
    { kind: "squircle", power: 3 },
    { kind: "burst", points: 12, depth: 0.075 },
    { kind: "burst", points: 10, depth: 0.06 },
    { kind: "poly", sides: 3, round: 0.7, turn: -Math.PI / 2 },
  ];
  const named = GLYPH_RULES.find(([re]) => re.test(name))?.[1];
  const glyph = named ?? FALLBACK_GLYPHS[slice(5, FALLBACK_GLYPHS.length)];
  return {
    silhouette: silhouettes[slice(0, silhouettes.length)],
    pattern: PATTERNS[slice(9, PATTERNS.length)],
    palette: PALETTES[slice(14, PALETTES.length)],
    glyph,
    angle: 20 + slice(19, 12) * 12,
    serial: (h >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(0, 7),
  };
}

/** Sampled outline of a silhouette, centred on (cx, cy) with outer radius r, as an SVG path. */
export function silhouettePath(s: Silhouette, r: number, cx = 60, cy = 60, steps = 144): string {
  const pts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const rad = radiusAt(s, t) * r;
    pts.push(`${(cx + rad * Math.sin(t)).toFixed(2)} ${(cy - rad * Math.cos(t)).toFixed(2)}`);
  }
  return `M${pts.join(" L")}Z`;
}

function radiusAt(s: Silhouette, t: number): number {
  switch (s.kind) {
    case "rosette": return (1 - s.depth) + s.depth * Math.cos(s.lobes * t);
    case "burst": return (1 - s.depth) + s.depth * Math.cos(s.points * t) ** 3;
    case "squircle": return 1 / (Math.abs(Math.cos(t)) ** s.power + Math.abs(Math.sin(t)) ** s.power) ** (1 / s.power) / 1.12;
    case "poly": {
      const seg = (Math.PI * 2) / s.sides;
      const local = ((((t - s.turn) % seg) + seg) % seg) - seg / 2;
      const poly = Math.cos(Math.PI / s.sides) / Math.cos(local);
      return poly * (1 - s.round) + s.round;
    }
  }
}
