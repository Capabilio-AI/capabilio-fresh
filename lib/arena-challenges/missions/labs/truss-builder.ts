import { fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome } from "../types";
import { analyseTruss, MATERIALS, memberLength, SECTIONS, type Joint, type Load, type Member, type Support, type TrussResult } from "../sim/truss";

// Structural Analysis: the student builds a bridge truss on a canvas. Joint forces come from the direct stiffness method, so a member is in
// tension or compression because of the geometry the student chose, and a missing member really does make a mechanism.
interface S {
  n: number;
  span: number;
  height: number;
  loadKn: number;
  loadJoint: number;
  material: "steel" | "aluminium";
  budgetKg: number;
  deflectionMm: number;
}

const MAX_DESIGN = 3000;
const MAX_MEMBERS = 40;
/** members may reach this many panel widths: long enough for a Pratt or Howe layout, too short to jump the whole span */
const REACH = 2.2;

export function geometry(s: Pick<S, "n" | "span" | "height">): { joints: Joint[]; supports: Support[]; names: string[] } {
  const w = s.span / s.n;
  const joints: Joint[] = [];
  const names: string[] = [];
  for (let i = 0; i <= s.n; i++) { joints.push({ x: i * w, y: 0 }); names.push(`B${i}`); }
  for (let i = 0; i < s.n; i++) { joints.push({ x: (i + 0.5) * w, y: s.height }); names.push(`T${i}`); }
  return { joints, supports: [{ joint: 0, kind: "pin" }, { joint: s.n, kind: "roller" }], names };
}

export function candidatePairs(s: Pick<S, "n" | "span" | "height">): [number, number][] {
  const { joints } = geometry(s);
  const reach = (s.span / s.n) * REACH;
  const out: [number, number][] = [];
  // a member that passes straight through another joint is really two members laid end to end, and would sit on top of them on the canvas
  const throughJoint = (a: number, b: number) =>
    joints.some((j, k) => k !== a && k !== b && Math.abs((joints[b].x - joints[a].x) * (j.y - joints[a].y) - (joints[b].y - joints[a].y) * (j.x - joints[a].x)) < 1e-6 && Math.min(joints[a].x, joints[b].x) - 1e-9 <= j.x && j.x <= Math.max(joints[a].x, joints[b].x) + 1e-9 && Math.min(joints[a].y, joints[b].y) - 1e-9 <= j.y && j.y <= Math.max(joints[a].y, joints[b].y) + 1e-9);
  for (let a = 0; a < joints.length; a++) for (let b = a + 1; b < joints.length; b++) if (memberLength(joints, { a, b, size: 0 }) <= reach + 1e-9 && !throughJoint(a, b)) out.push([a, b]);
  return out;
}

const loadsOf = (s: S): Load[] => [{ joint: s.loadJoint, fx: 0, fy: -s.loadKn }];

/** A student's design string read defensively; anything malformed is simply "no design". */
export function parseDesign(raw: unknown, s: Pick<S, "n" | "span" | "height">): Member[] {
  if (typeof raw !== "string" || raw === "") return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  const list = (data as { m?: unknown })?.m;
  if (!Array.isArray(list)) return [];
  const count = s.n * 2 + 1;
  const allowed = new Set(candidatePairs(s).map(([a, b]) => `${a}-${b}`));
  const byKey = new Map<string, Member>();
  for (const e of list.slice(0, MAX_MEMBERS)) {
    if (!Array.isArray(e) || e.length < 3) continue;
    const [x, y, z] = e.map(Number);
    if (![x, y, z].every(Number.isInteger) || x < 0 || y < 0 || x >= count || y >= count || x === y || z < 0 || z >= SECTIONS.length) continue;
    const a = Math.min(x, y);
    const b = Math.max(x, y);
    if (!allowed.has(`${a}-${b}`)) continue;
    const k = `${a}-${b}`;
    byKey.set(k, { a, b, size: Math.max(z, byKey.get(k)?.size ?? 0) });
  }
  return [...byKey.values()];
}

const encode = (members: Member[]): string => JSON.stringify({ m: members.map((m) => [m.a, m.b, m.size]) });
const analyse = (s: S, members: Member[]): TrussResult => {
  const g = geometry(s);
  return analyseTruss({ joints: g.joints, supports: g.supports, loads: loadsOf(s), members, material: MATERIALS[s.material] });
};

/** The classic Warren layout with each member sized to the smallest section that carries its force with margin. */
function warren(s: S): Member[] {
  const members: Member[] = [];
  for (let i = 0; i < s.n; i++) members.push({ a: i, b: i + 1, size: 1 });
  for (let i = 0; i < s.n - 1; i++) members.push({ a: s.n + 1 + i, b: s.n + 2 + i, size: 1 });
  for (let i = 0; i < s.n; i++) {
    members.push({ a: i, b: s.n + 1 + i, size: 1 });
    members.push({ a: s.n + 1 + i, b: i + 1, size: 1 });
  }
  const forces = analyse(s, members);
  if (!forces.stable) return members;
  return members.map((m, i) => {
    for (let size = 0; size < SECTIONS.length; size++) {
      const trial = analyse(s, members.map((x, j) => (j === i ? { ...x, size } : x)));
      if (trial.stable && trial.utilisation[i] <= 0.9) return { ...m, size };
    }
    return { ...m, size: SECTIONS.length - 1 };
  });
}

const lab: Lab<S> = {
  key: "truss-builder",
  family: "mech",
  format: "puzzle",
  surface: "truss",
  name: "Truss design studio",
  topic: "Strength of Materials · Pin-jointed trusses",
  keywords: ["strength of materials", "mechanics of solids", "engineering mechanics", "structural", "machine design", "statics", "design of machine"],
  tools: ["Joint canvas", "Member sections", "Force solver", "Buckling check"],
  skillTags: ["Truss analysis", "Tension and compression", "Member sizing"],
  makeScenario(rng, d) {
    const n = rng.pick([3, 4, 4, 5]);
    const base: S = { n, span: n * rng.pick([1.5, 2, 2.5]), height: rng.pick([1.5, 2, 2.5]), loadKn: rng.int(4, 10) * 2, loadJoint: Math.max(1, Math.round(n / 2) + rng.int(-1, 0)), material: rng.pick(["steel", "steel", "aluminium"]), budgetKg: 0, deflectionMm: 0 };
    const ref = analyse(base, warren(base));
    const room = d === "easy" ? { mass: 1.45, defl: 1.5 } : d === "medium" ? { mass: 1.25, defl: 1.25 } : { mass: 1.12, defl: 1.1 };
    return { ...base, budgetKg: Math.ceil(ref.massKg * room.mass), deflectionMm: Math.ceil(Math.max(ref.maxDeflectionMm * room.defl, 0.5) * 10) / 10 };
  },
  given: (s) => [
    { label: "Span and height", value: `${fmt(s.span, 1)} m by ${fmt(s.height, 1)} m` },
    { label: "Load at the marked joint", value: `${s.loadKn} kN downward` },
    { label: "Material", value: `${MATERIALS[s.material].name}, allowable ${MATERIALS[s.material].allowMpa} MPa` },
    { label: "Weight budget", value: `${s.budgetKg} kg` },
  ],
  mission: (s) => `Join the joints with members and choose a section for each so the truss stands, no member is overstressed or buckles, it sags no more than ${s.deflectionMm} mm, and it weighs at most ${s.budgetKg} kg.`,
  controls: () => [{ kind: "design", id: "design", label: "Truss design", default: "", maxLen: MAX_DESIGN }],
  surfaceData: (s) => {
    const g = geometry(s);
    return { joints: g.joints.map((j, i) => ({ ...j, name: g.names[i] })), supports: g.supports, load: { joint: s.loadJoint, kn: s.loadKn }, candidates: candidatePairs(s), sections: SECTIONS, material: MATERIALS[s.material].name, budgetKg: s.budgetKg, deflectionMm: s.deflectionMm, maxMembers: MAX_MEMBERS };
  },
  reference: (s) => ({ design: encode(warren(s)) }),
  evaluate(s, st): Outcome {
    const members = parseDesign(st.design, s);
    const r = analyse(s, members);
    const g = geometry(s);
    const worst = r.stable ? Math.max(0, ...r.utilisation) : 0;
    const over = r.stable ? members.flatMap((m, i) => (r.utilisation[i] > 1 ? [i] : [])) : [];
    const objectives = [
      objective("stable", "The truss is stable", r.stable, r.stable ? `${members.length} members, no mechanism` : r.reason ?? "not stable", "A truss stands only if its members form triangles. A square of four members can fold flat."),
      objective("strength", "Every member is within its limit", r.stable && over.length === 0, !r.stable ? "needs a stable truss first" : over.length === 0 ? `worst member at ${fmt(worst * 100, 0)}%` : `${over.length} member(s) overstressed or buckling`, "Look at which members the solver colours red. A member in compression buckles long before it crushes, so give it a bigger section."),
      objective("stiff", `Sags at most ${s.deflectionMm} mm`, r.stable && r.maxDeflectionMm <= s.deflectionMm, r.stable ? `${fmt(r.maxDeflectionMm, 1)} mm` : "needs a stable truss first", "Stiffness comes from the sections along the bottom and top chords as much as from the diagonals."),
      objective("light", `Weighs at most ${s.budgetKg} kg`, r.stable && r.massKg <= s.budgetKg, r.stable ? `${fmt(r.massKg, 1)} kg` : "needs a stable truss first", "Heavy sections everywhere will pass strength and fail the budget. Size each member to the force it actually carries."),
    ];
    const names = (a: number, b: number) => `${g.names[a]}–${g.names[b]}`;
    return {
      readings: [
        gauge("util", "Worst member", worst, r.stable ? `${fmt(worst * 100, 0)}% of its limit` : "n/a", { min: 0, max: 1.5, high: 1 }),
        gauge("mass", "Weight", r.massKg, r.stable ? `${fmt(r.massKg, 1)} kg` : "n/a", { min: 0, max: s.budgetKg * 1.6, high: s.budgetKg }),
        gauge("defl", "Sag", r.maxDeflectionMm, r.stable ? `${fmt(r.maxDeflectionMm, 1)} mm` : "n/a", { min: 0, max: s.deflectionMm * 2, high: s.deflectionMm }),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      table: r.stable ? { title: "Member forces", columns: ["Member", "Force", "Of its limit", "Section"], rows: members.map((m, i) => [names(m.a, m.b), `${fmt(Math.abs(r.forces[i]), 1)} kN ${r.forces[i] >= 0 ? "tension" : "compression"}`, `${fmt(r.utilisation[i] * 100, 0)}%`, SECTIONS[m.size].label]), bad: over } : undefined,
      overlay: r.stable ? { members: members.map((m, i) => ({ a: m.a, b: m.b, force: Number(r.forces[i].toFixed(2)), util: Number(r.utilisation[i].toFixed(3)) })) } : undefined,
    };
  },
  explain(s, st, o) {
    const members = parseDesign(st.design, s);
    const r = analyse(s, members);
    const tension = r.forces.filter((f) => f > 0.01).length;
    const compression = r.forces.filter((f) => f < -0.01).length;
    return `Your ${members.length}-member truss carries the ${s.loadKn} kN load with ${tension} members in tension and ${compression} in compression, weighs ${fmt(r.massKg, 1)} kg and sags ${fmt(r.maxDeflectionMm, 1)} mm. Tension members only need enough area to stay under ${MATERIALS[s.material].allowMpa} MPa, but compression members must also resist buckling, which is why the long compressed members needed bigger sections. ${o.passed ? "Triangulation is what turned loose bars into a structure." : ""}`;
  },
  fallback: (s) => ({ title: `Design a ${fmt(s.span, 0)} m footbridge truss`, story: `A village needs a light ${MATERIALS[s.material].name.toLowerCase()} truss over a ${fmt(s.span, 1)} m stream. The engineer must choose the members and sections that carry a ${s.loadKn} kN load without wasting steel.` }),
};
export default defineLab(lab);
