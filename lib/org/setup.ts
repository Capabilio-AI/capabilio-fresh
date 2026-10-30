import type { OrgPermissionKey } from "./roles";

export interface SetupInput {
  profilePublic: boolean;
  hasBio: boolean;
  hasWebsite: boolean;
  publishedPosts: number;
  materials: number;
  projects: number;
  drives: number;
  students: number;
}

export interface SetupStep {
  label: string;
  hint: string;
  done: boolean;
  /** null when the viewer cannot open the page this step points at (no dead links) */
  href: string | null;
}

/**
 * Pure. Every step maps to something that is genuinely checkable in the database — the same idea as the
 * reference's trust checklist, but nothing is a placeholder and nothing implies a review that hasn't happened.
 */
export function buildSetupChecklist(i: SetupInput, permissions?: ReadonlySet<OrgPermissionKey>): SetupStep[] {
  // a link is only offered when the target page's nav permission (see nav.ts) is held; omitted set = everything allowed
  const link = (href: string, needs: OrgPermissionKey): string | null => (!permissions || permissions.has(needs) ? href : null);
  return [
    { label: "Write your college's About", hint: "Two or three lines students and visitors read first.", done: i.hasBio, href: "/org/college?edit=1" },
    { label: "Add your website", hint: "Lets visitors verify who you are.", done: i.hasWebsite, href: "/org/college?edit=1" },
    { label: "Publish your college page", hint: "Public pages are off until you turn them on.", done: i.profilePublic, href: "/org/college?edit=1" },
    { label: "Get students signed up", hint: "Share your student join link (Team & access) so they land in your college.", done: i.students > 0, href: link("/org/team", "members") },
    { label: "Share a course material or project", hint: "Gives students something to do on day one.", done: i.materials + i.projects > 0, href: link(i.materials > 0 ? "/org/projects" : "/org/materials", "classroom") },
    { label: "Post an event or announcement", hint: "Your first update appears on the college page.", done: i.publishedPosts > 0, href: "/org/college" },
    { label: "Post a placement drive", hint: "Final-year students see it in Launchpad.", done: i.drives > 0, href: link("/org/placements", "placements") },
  ];
}
