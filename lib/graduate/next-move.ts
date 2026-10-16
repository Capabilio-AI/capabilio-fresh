// The one thing a recently graduated user should do next, chosen from real state. Pure.

export interface UnlockTarget {
  skillId: string;
  name: string;
  /** 0-1, how far along the practice is */
  progress: number;
  /** an Arena skill area that builds it, so the button can open the right ticket */
  areaKey: string | null;
}
export interface TopRole {
  id: string;
  role: string;
  company: string;
  percent: number | null;
}

export interface MoveInput {
  hasLevel: boolean;
  roleName: string | null;
  provenCount: number;
  target: UnlockTarget | null;
  interviewCount: number;
  interviewUnlocked: boolean;
  applicationCount: number;
  topRole: TopRole | null;
}
export interface Move {
  key: "assess" | "first-proof" | "keep-proving" | "interview" | "apply";
  title: string;
  body: string;
  cta: { label: string; href: string };
  /** the badge to show being unlocked, when the move is about proving a skill */
  unlock: UnlockTarget | null;
}

/** Proving skills comes before interviews and applications, but three proven skills are enough to start the rest. */
export const ENOUGH_PROOF_TO_APPLY = 3;

const arenaHref = (t: UnlockTarget | null) => (t?.areaKey ? `/arena/challenges/domain?focus=${encodeURIComponent(t.areaKey)}` : "/arena/challenges/domain");

export function nextMove(x: MoveInput): Move {
  if (!x.hasLevel) {
    return { key: "assess", title: "Find your starting point", body: `The career assessment shows where you begin${x.roleName ? ` for ${x.roleName}` : ""}. It does not earn badges: it tells us which work to give you first.`, cta: { label: "Take the assessment", href: "/assessment" }, unlock: null };
  }
  if (x.provenCount === 0) {
    return {
      key: "first-proof",
      title: x.target ? `Prove ${x.target.name}` : "Prove your first skill",
      body: "You have no proven skills yet, and recruiters can only trust work they can see. One verified Arena ticket earns your first badge and starts your rating.",
      cta: { label: "Start an Arena ticket", href: arenaHref(x.target) },
      unlock: x.target,
    };
  }
  if (x.provenCount < ENOUGH_PROOF_TO_APPLY) {
    return {
      key: "keep-proving",
      title: x.target ? `Unlock ${x.target.name}` : "Prove another skill",
      body: `${x.provenCount} ${x.provenCount === 1 ? "skill" : "skills"} proven so far. Each one makes your passport harder to ignore, and ${ENOUGH_PROOF_TO_APPLY} is a solid base to start applying.`,
      cta: { label: "Start an Arena ticket", href: arenaHref(x.target) },
      unlock: x.target,
    };
  }
  if (x.interviewCount === 0) {
    return x.interviewUnlocked
      ? { key: "interview", title: "Practise an interview round", body: "You have proof to talk about. A mock round makes the real one feel familiar, and you get feedback while it is still cheap.", cta: { label: "Start a round", href: "/dashboard/interview" }, unlock: null }
      : { key: "interview", title: "Practise before it counts", body: "AI mock interviews are part of Pro and Elite. They give you feedback on technical, behavioural and HR rounds.", cta: { label: "See plans", href: "/plans" }, unlock: null };
  }
  if (x.applicationCount === 0) {
    const r = x.topRole;
    return {
      key: "apply",
      title: r ? `Apply to ${r.role}` : "Start applying",
      body: r ? `${r.company}${r.percent !== null ? `, ${r.percent}% match with your measured skills` : ""}. Apply with the passport you have built.` : "You have proof and practice. Browse Launchpad for roles that fit.",
      cta: { label: r ? "See the role" : "Browse Launchpad", href: "/launchpad" },
      unlock: null,
    };
  }
  return { key: "keep-proving", title: x.target ? `Keep going: ${x.target.name}` : "Keep proving", body: "Every verified ticket adds to your passport while your applications are out.", cta: { label: "Start an Arena ticket", href: arenaHref(x.target) }, unlock: x.target };
}
