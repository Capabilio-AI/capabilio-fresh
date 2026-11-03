import { Briefcase, CalendarDays, GraduationCap, Megaphone, PartyPopper, Sparkles, Trophy, type LucideIcon } from "lucide-react";

export type PostKindId = "announcement" | "event" | "fest" | "poster" | "achievement" | "admissions" | "update" | "hiring" | "milestone";

export interface PostKind {
  id: PostKindId;
  label: string;
  icon: LucideIcon;
  /** colour tokens (app-* variables, so it reads in both the light workspace and the dark public page) */
  chip: string;
  heading: string;
  placeholder: string;
  /** has a start date, a venue and an attend button; stored as an `event` post */
  dated: boolean;
  /** a poster needs its image */
  needsImage: boolean;
  /** has a headline field */
  headline: boolean;
  linkLabel: string;
}

export const POST_KINDS: PostKind[] = [
  { id: "announcement", label: "Announcement", icon: Megaphone, chip: "bg-app-orange-container text-app-orange", heading: "Share an update", placeholder: "What do you want to tell students?", dated: false, needsImage: false, headline: false, linkLabel: "Link" },
  { id: "event", label: "Event", icon: CalendarDays, chip: "bg-app-blue-container text-app-blue", heading: "Announce an event", placeholder: "Describe the event: workshop, guest lecture, seminar…", dated: true, needsImage: false, headline: true, linkLabel: "Registration link" },
  { id: "fest", label: "Fest", icon: PartyPopper, chip: "bg-app-rose-container text-app-rose", heading: "Announce a fest", placeholder: "Tell people what the fest is about, what's on and who can join.", dated: true, needsImage: false, headline: true, linkLabel: "Registration link" },
  { id: "poster", label: "Poster launch", icon: Sparkles, chip: "bg-app-warning-container text-app-warning", heading: "Launch a poster", placeholder: "Add a line to go with the poster.", dated: false, needsImage: true, headline: true, linkLabel: "Link" },
  { id: "achievement", label: "Achievement", icon: Trophy, chip: "bg-app-success-container text-app-success", heading: "Celebrate an achievement", placeholder: "Rankings, awards, research, a student win…", dated: false, needsImage: false, headline: true, linkLabel: "Link" },
  { id: "admissions", label: "Admissions", icon: GraduationCap, chip: "bg-app-blue-container text-app-blue", heading: "Share an admissions notice", placeholder: "Programs, eligibility, last date…", dated: false, needsImage: false, headline: true, linkLabel: "Apply link" },
];

/** What a company's posts show as. Not in POST_KINDS: that list is the college composer's menu. */
const COMPANY_KINDS: PostKind[] = [
  { id: "update", label: "Update", icon: Megaphone, chip: "bg-app-orange-container text-app-orange", heading: "Share an update", placeholder: "", dated: false, needsImage: false, headline: false, linkLabel: "Link" },
  { id: "hiring", label: "Hiring", icon: Briefcase, chip: "bg-app-blue-container text-app-blue", heading: "Share hiring news", placeholder: "", dated: false, needsImage: false, headline: false, linkLabel: "Link" },
  { id: "milestone", label: "Milestone", icon: Trophy, chip: "bg-app-success-container text-app-success", heading: "Share a milestone", placeholder: "", dated: false, needsImage: false, headline: false, linkLabel: "Link" },
];

const BY_ID = Object.fromEntries([...POST_KINDS, ...COMPANY_KINDS].map((k) => [k.id, k])) as Record<PostKindId, PostKind>;

/** The kind a stored post shows as; posts made before categories existed are an event or an announcement, and a company's update, hiring or milestone post shows as itself. */
export function kindOf(post: { category?: string | null; type: string }): PostKind {
  const id = (post.category ?? (post.type === "event" || post.type in BY_ID ? post.type : "announcement")) as PostKindId;
  return BY_ID[id] ?? BY_ID.announcement;
}
