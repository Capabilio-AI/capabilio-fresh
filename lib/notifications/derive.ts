import type { SectionScore } from "@/lib/dashboard/data";

export interface Notification {
  id: string;
  tone: "attention" | "info" | "success";
  title: string;
  body: string;
  href: string;
}

const LOW_SCORE_THRESHOLD = 50;

export interface DeriveNotificationsInput {
  sectionScores?: SectionScore[];
  topGapSkill?: string | null;
  vaultItemCount: number;
  hasGuidePath: boolean;
  /** set when the college's roll-number check needs the student to act */
  rollNumber?: { collegeName: string; kind: "missing" | "mismatch"; daysLeft: number | null } | null;
}

/**
 * Notifications are computed from the student's real current state, not a
 * stored event log — there is no notifications table yet, and this app
 * never fabricates activity history. Every entry here is re-derivable at
 * read time from data that already exists.
 */
export function deriveNotifications(input: DeriveNotificationsInput): Notification[] {
  const notifications: Notification[] = [];

  if (input.rollNumber) {
    const { collegeName, kind, daysLeft } = input.rollNumber;
    const window = daysLeft === null ? "soon" : `within ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
    notifications.push({
      id: "roll-number",
      tone: "attention",
      title: kind === "missing" ? "Add your college roll number" : "Your roll number doesn't match your college",
      body: `${kind === "missing" ? `${collegeName} needs your roll number.` : `It doesn't carry ${collegeName}'s code.`} Update it ${window} or your account will be removed.`,
      href: "/dashboard",
    });
  }

  for (const score of input.sectionScores ?? []) {
    if (score.section === "career_interests") continue;
    if (score.percentage < LOW_SCORE_THRESHOLD) {
      notifications.push({
        id: `low-score-${score.section}`,
        tone: "attention",
        title: `${score.label} needs attention`,
        body: `You scored ${score.percentage}% (${score.correct}/${score.total}). This is pulling down related skill gaps.`,
        href: "/dashboard/skill-gap",
      });
    }
  }

  if (input.topGapSkill) {
    notifications.push({
      id: "top-gap",
      tone: "info",
      title: `New skill gap identified: ${input.topGapSkill}`,
      body: "This is currently your biggest lever toward your top career match.",
      href: "/skillstudio",
    });
  }

  if (input.vaultItemCount === 0) {
    notifications.push({
      id: "empty-vault",
      tone: "attention",
      title: "Your Vault is empty",
      body: "Add a certificate, project, or link — Vault evidence is what your Portfolio is built from.",
      href: "/dashboard/vault",
    });
  }

  if (!input.hasGuidePath) {
    notifications.push({
      id: "no-guide-path",
      tone: "info",
      title: "Generate your personalized learning path",
      body: "A phased plan sequenced against your actual skill gaps is ready to generate.",
      href: "/dashboard/career-path",
    });
  }

  return notifications;
}
